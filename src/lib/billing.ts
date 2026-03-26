// ---------------------------------------------------------------------------
// Centralized billing configuration and helpers
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "node:crypto";

import { anyApi } from "convex/server";

import { fetchProductMutation, fetchProductQuery } from "@/lib/convex";
import { getDodoApiBase } from "@/lib/env";
import { logEvent, logError } from "@/lib/logger";

/**
 * Shape of a single plan definition inside PLAN_CONFIG.
 */
export interface PlanDefinition {
  readonly id: string;
  readonly name: string;
  readonly priceMonthly: number;
  readonly monthlyTokenAllowance: number;
  readonly dodoProductId: string | null;
}

/**
 * The sole source of truth for plan definitions.
 * Every part of the system that needs plan details MUST read from here.
 */
export const PLAN_CONFIG: Record<"free" | "standard", PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    monthlyTokenAllowance: 100_000,
    dodoProductId: null,
  },
  standard: {
    id: "standard",
    name: "Standard",
    priceMonthly: 19,
    monthlyTokenAllowance: 10_000_000,
    dodoProductId: process.env.DODO_STANDARD_PRODUCT_ID ?? "",
  },
} as const;

/**
 * Resolve a plan by its ID, or `undefined` for unknown IDs.
 */
export function getPlanById(planId: string): PlanDefinition | undefined {
  // Support legacy "pro" plan IDs from existing subscriptions
  if (planId === "pro") return PLAN_CONFIG.standard;
  if (planId === "free" || planId === "standard") {
    return PLAN_CONFIG[planId];
  }
  return undefined;
}

/**
 * Fallback token cost applied to image generations when the model does not
 * report usage data.
 */
/**
 * Gemini 3 Pro Image: ~560 input + ~1120-2000 output tokens depending on
 * resolution. 2 000 covers the common 1K/2K case with a small buffer for
 * higher-res 4K outputs.
 */
export const FALLBACK_IMAGE_TOKEN_COST = 2_000;

// ---------------------------------------------------------------------------
// Billing cycle helpers
// ---------------------------------------------------------------------------

interface SubscriptionPeriod {
  currentPeriodStart: number;
  currentPeriodEnd: number;
}

/**
 * Determine the billing cycle boundaries.
 *
 * - When a subscription with valid period dates is provided (end > start by
 *   at least 1 hour), those dates are used.
 * - Otherwise falls back to calendar-month boundaries (start of current month
 *   through start of next month).
 */
export function getBillingCycleDates(
  subscription?: SubscriptionPeriod | null,
): { cycleStart: number; cycleEnd: number } {
  if (
    subscription?.currentPeriodStart &&
    subscription?.currentPeriodEnd &&
    // Guard against degenerate windows where start ≈ end (broken webhook data)
    subscription.currentPeriodEnd - subscription.currentPeriodStart > 3_600_000
  ) {
    return {
      cycleStart: subscription.currentPeriodStart,
      cycleEnd: subscription.currentPeriodEnd,
    };
  }

  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const cycleEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  ).getTime();
  return { cycleStart, cycleEnd };
}

// ---------------------------------------------------------------------------
// Usage percentage & meter state
// ---------------------------------------------------------------------------

/**
 * Calculate usage as a whole-number percentage clamped to 0–100.
 */
export function calculateUsagePercent(
  currentUsage: number,
  allowance: number,
): number {
  if (allowance <= 0) return 100;
  return Math.min(100, Math.round((currentUsage / allowance) * 100));
}

// ---------------------------------------------------------------------------
// Token usage tracking
// ---------------------------------------------------------------------------

export interface TrackTokenUsageParams {
  organizationId: string;
  userId: string;
  featureType: "chat" | "image" | "image_tool" | "rewrite";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  conversationId?: string;
}

/**
 * Record a token-usage event in Convex. Fire-and-forget safe — errors are
 * logged as wide events but never thrown, so the AI response is never blocked.
 */
export async function trackTokenUsage(params: TrackTokenUsageParams): Promise<void> {
  try {
    await fetchProductMutation(anyApi.billing.insertUsageRecord, {
      clerkOrganizationId: params.organizationId,
      clerkUserId: params.userId,
      featureType: params.featureType,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      model: params.model,
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    });

    logEvent("info", "billing.usage.recorded", {
      organizationId: params.organizationId,
      userId: params.userId,
      featureType: params.featureType,
      totalTokens: params.totalTokens,
      model: params.model,
    });
  } catch (error) {
    logError("billing.usage.record_failed", error, {
      organizationId: params.organizationId,
      userId: params.userId,
      featureType: params.featureType,
      totalTokens: params.totalTokens,
      model: params.model,
    });
  }
}

// ---------------------------------------------------------------------------
// Quota enforcement
// ---------------------------------------------------------------------------

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  allowance: number;
  percentUsed: number;
}

/**
 * Check whether an Organization is within its token allowance for the current
 * billing cycle. Uses a soft cap — `allowed` is true when `currentUsage < allowance`.
 *
 * Falls back to the Free plan allowance and calendar-month cycle when the org
 * has no active subscription.
 */
export async function checkQuota(organizationId: string): Promise<QuotaCheckResult> {
  const subscription = await fetchProductQuery(
    anyApi.billing.getSubscriptionByOrg,
    { clerkOrganizationId: organizationId },
  );

  const isActive = subscription?.status === "active";
  const allowance = isActive
    ? (subscription.monthlyTokenAllowance || PLAN_CONFIG.free.monthlyTokenAllowance)
    : PLAN_CONFIG.free.monthlyTokenAllowance;
  const { cycleStart, cycleEnd } = getBillingCycleDates(
    isActive ? subscription : null,
  );

  const currentUsage = await fetchProductQuery(
    anyApi.billing.getOrgUsageForPeriod,
    {
      clerkOrganizationId: organizationId,
      periodStart: cycleStart,
      periodEnd: cycleEnd,
    },
  );

  const allowed = currentUsage < allowance;
  const percentUsed = calculateUsagePercent(currentUsage, allowance);

  logEvent("info", "billing.quota.checked", {
    organizationId,
    currentUsage,
    allowance,
    percentUsed,
    allowed,
    subscriptionStatus: subscription?.status ?? "none",
  });

  return { allowed, currentUsage, allowance, percentUsed };
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Dodo Payments webhook signature using the Standard Webhooks spec.
 *
 * The signed message is: `{webhook-id}.{webhook-timestamp}.{body}`
 * HMAC-SHA256 with the webhook secret (base64-decoded).
 * The `webhook-signature` header contains one or more `v1,<base64sig>` entries.
 */
export function verifyDodoWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookId: string,
  webhookTimestamp: string,
  secret: string,
): boolean {
  try {
    // Standard Webhooks secrets are base64-encoded, optionally prefixed with "whsec_"
    const secretRaw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const secretBytes = Buffer.from(secretRaw, "base64");

    const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`;
    const expected = createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    // The header can contain multiple signatures separated by spaces: "v1,<sig1> v1,<sig2>"
    const signatures = signatureHeader.split(" ");
    for (const sig of signatures) {
      const parts = sig.split(",");
      if (parts[0] !== "v1" || !parts[1]) continue;
      const candidateBuf = Buffer.from(parts[1], "base64");
      const expectedBuf = Buffer.from(expected, "base64");
      if (candidateBuf.length !== expectedBuf.length) continue;
      if (timingSafeEqual(candidateBuf, expectedBuf)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Metered usage reporting to Dodo Payments
// ---------------------------------------------------------------------------

export interface ReportMeteredUsageParams {
  subscriptionId: string;
  organizationId: string;
  totalTokens: number;
  periodStart: number;
  periodEnd: number;
}

/**
 * Report aggregated org-level token usage to the Dodo Payments metered billing
 * API. Retries with exponential backoff (max 3 attempts) on failure.
 *
 * Throws the last error if all retries are exhausted — the caller decides how
 * to handle it.
 */
export async function reportMeteredUsage(params: ReportMeteredUsageParams): Promise<void> {
  const { getDodoBillingEnv } = await import("@/lib/env");
  const billingEnv = getDodoBillingEnv();

  if (!billingEnv) {
    logEvent("warn", "billing.metered_report.not_configured", {
      organizationId: params.organizationId,
    });
    return;
  }

  const dodoBase = getDodoApiBase();
  const url = `${dodoBase}/subscriptions/${params.subscriptionId}/usage`;
  const body = JSON.stringify({
    quantity: params.totalTokens,
    timestamp: new Date().toISOString(),
  });

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${billingEnv.DODO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`Dodo API responded with ${response.status}: ${await response.text()}`);
      }

      logEvent("info", "billing.metered_report.sent", {
        organizationId: params.organizationId,
        subscriptionId: params.subscriptionId,
        totalTokens: params.totalTokens,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      });
      return;
    } catch (error) {
      lastError = error;
      logError("billing.metered_report.failed", error, {
        organizationId: params.organizationId,
        subscriptionId: params.subscriptionId,
        attempt,
        maxAttempts,
      });

      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
