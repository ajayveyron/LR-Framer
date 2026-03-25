import { NextResponse } from "next/server";

import { anyApi } from "convex/server";

import {
  PLAN_CONFIG,
  type PlanDefinition,
  verifyDodoWebhookSignature,
} from "@/lib/billing";
import { fetchProductMutation } from "@/lib/convex";
import { sendEmail } from "@/lib/email";
import { getDodoBillingEnv } from "@/lib/env";
import { logError, logEvent } from "@/lib/logger";
import { ProUpgradeEmail } from "@/emails/pro-upgrade";

export const runtime = "nodejs";
const WEBHOOK_TOLERANCE_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Webhook payload shape (Standard Webhooks / Dodo format)
// ---------------------------------------------------------------------------

interface DodoWebhookPayload {
  business_id: string;
  type: string;
  timestamp: string;
  data: {
    payload_type: string;
    subscription_id?: string;
    customer?: { customer_id?: string };
    product_id?: string;
    status?: string;
    metadata?: Record<string, string>;
    // Dodo uses previous/next billing dates, NOT current_period_start/end
    previous_billing_date?: string;
    next_billing_date?: string;
    created_at?: string;
    payment_frequency_interval?: string;
    payment_frequency_count?: number;
    // Flat fields that may appear at data level
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findPlanByProductId(productId: string): PlanDefinition | undefined {
  for (const plan of Object.values(PLAN_CONFIG)) {
    if (plan.dodoProductId && plan.dodoProductId === productId) {
      return plan;
    }
  }
  return undefined;
}

function parsePeriodTimestamp(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function parseWebhookTimestamp(value: string): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Derive billing cycle start/end from Dodo's webhook data.
 *
 * Dodo sends `previous_billing_date` (cycle start) and `next_billing_date`
 * (cycle end). When either is missing we fall back to a calendar-month window
 * anchored at the subscription's `created_at` or "now".
 */
function derivePeriodDates(data: DodoWebhookPayload["data"]): {
  periodStart: number;
  periodEnd: number;
} {
  const prev = parsePeriodTimestamp(data.previous_billing_date);
  const next = parsePeriodTimestamp(data.next_billing_date);

  if (prev && next && next > prev) {
    return { periodStart: prev, periodEnd: next };
  }

  // Fallback: use created_at as anchor, build a 1-month window
  const anchor = parsePeriodTimestamp(data.created_at) ?? Date.now();
  const anchorDate = new Date(anchor);
  const periodStart = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    anchorDate.getDate(),
  ).getTime();
  const periodEnd = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth() + 1,
    anchorDate.getDate(),
  ).getTime();

  return { periodStart, periodEnd };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const billingEnv = getDodoBillingEnv();
  if (!billingEnv) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 },
    );
  }

  // Read raw body for signature verification
  const rawBody = await request.text();

  // Standard Webhooks headers
  const webhookId = request.headers.get("webhook-id") ?? "";
  const webhookTimestamp = request.headers.get("webhook-timestamp") ?? "";
  const webhookSignature = request.headers.get("webhook-signature") ?? "";
  const timestampMs = parseWebhookTimestamp(webhookTimestamp);

  if (
    timestampMs === null ||
    Math.abs(Date.now() - timestampMs) > WEBHOOK_TOLERANCE_MS
  ) {
    logEvent("warn", "billing.webhook.timestamp_invalid", {
      webhookId,
      webhookTimestamp,
    });
    return NextResponse.json({ error: "Invalid timestamp" }, { status: 401 });
  }

  if (
    !verifyDodoWebhookSignature(
      rawBody,
      webhookSignature,
      webhookId,
      webhookTimestamp,
      billingEnv.DODO_WEBHOOK_SECRET,
    )
  ) {
    logEvent("warn", "billing.webhook.signature_invalid", {
      webhookId,
      signaturePresent: Boolean(webhookSignature),
      timestampPresent: Boolean(webhookTimestamp),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const replayCheck = await fetchProductMutation(
    anyApi.billing.recordWebhookEventIfNew,
    {
      provider: "dodo",
      webhookId,
    },
  );

  if (!replayCheck.inserted) {
    logEvent("warn", "billing.webhook.replayed", {
      webhookId,
    });
    return NextResponse.json({ received: true });
  }

  let payload: DodoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DodoWebhookPayload;
  } catch {
    logEvent("warn", "billing.webhook.parse_failed");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type;
  const data = payload.data;

  // Extract fields — Dodo may nest customer or put fields flat
  const subscriptionId =
    (data.subscription_id as string) ?? "";
  const customerId =
    (data.customer?.customer_id as string) ?? "";
  const productId =
    (data.product_id as string) ?? "";
  const organizationId =
    data.metadata?.clerkOrganizationId ?? null;

  // Log wide event for every webhook received
  logEvent("info", "billing.webhook.received", {
    webhookId,
    eventType,
    subscriptionId,
    productId,
    organizationId,
    businessId: payload.business_id,
    previousBillingDate: data.previous_billing_date ?? null,
    nextBillingDate: data.next_billing_date ?? null,
    createdAt: data.created_at ?? null,
  });

  // Unknown organization — log warning, return 200 to prevent retries
  if (!organizationId) {
    logEvent("warn", "billing.webhook.unknown_organization", {
      eventType,
      subscriptionId,
      customerId,
    });
    return NextResponse.json({ received: true });
  }

  try {
    switch (eventType) {
      case "subscription.active": {
        const plan = findPlanByProductId(productId);
        if (!plan) {
          logError("billing.webhook.unknown_plan", new Error("Unknown plan ID"), {
            productId,
            eventType,
            organizationId,
          });
          return NextResponse.json({ received: true });
        }

        const activePeriod = derivePeriodDates(data);

        await fetchProductMutation(anyApi.billing.upsertSubscription, {
          clerkOrganizationId: organizationId,
          dodoSubscriptionId: subscriptionId,
          dodoCustomerId: customerId,
          planId: plan.id,
          status: "active",
          monthlyTokenAllowance: plan.monthlyTokenAllowance,
          currentPeriodStart: activePeriod.periodStart,
          currentPeriodEnd: activePeriod.periodEnd,
        });

        logEvent("info", "billing.webhook.subscription_activated", {
          organizationId,
          planId: plan.id,
          allowance: plan.monthlyTokenAllowance,
          subscriptionId,
          periodStart: new Date(activePeriod.periodStart).toISOString(),
          periodEnd: new Date(activePeriod.periodEnd).toISOString(),
        });

        // Send pro upgrade congratulatory email
        if (plan.id !== "free" && customerId) {
          const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
            : "https://framerbot.com/dashboard";

          // Dodo metadata may include the user's email from checkout
          const customerEmail =
            (data.customer?.customer_id as string) ||
            (data.metadata?.email as string | undefined);

          if (customerEmail?.includes("@")) {
            await sendEmail({
              to: customerEmail,
              subject: `You are now on the ${plan.name} plan — congrats`,
              react: ProUpgradeEmail({
                firstName: (data.metadata?.firstName as string | undefined) ?? undefined,
                planName: plan.name,
                dashboardUrl,
              }),
              eventName: "email.pro_upgrade_sent",
              metadata: { organizationId, planId: plan.id, subscriptionId },
            });
          }
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.expired": {
        const status =
          eventType === "subscription.cancelled" ? "cancelled" : "expired";
        const plan = findPlanByProductId(productId);
        const planId = plan?.id ?? "unknown";
        const cancelPeriod = derivePeriodDates(data);

        await fetchProductMutation(anyApi.billing.upsertSubscription, {
          clerkOrganizationId: organizationId,
          dodoSubscriptionId: subscriptionId,
          dodoCustomerId: customerId,
          planId,
          status,
          monthlyTokenAllowance: 0,
          currentPeriodStart: cancelPeriod.periodStart,
          currentPeriodEnd: cancelPeriod.periodEnd,
        });

        logEvent("info", `billing.webhook.subscription_${status}`, {
          organizationId,
          planId,
          subscriptionId,
        });
        break;
      }

      case "subscription.updated":
      case "subscription.renewed": {
        const plan = findPlanByProductId(productId);
        if (!plan) {
          logError("billing.webhook.unknown_plan", new Error("Unknown plan ID"), {
            productId,
            eventType,
            organizationId,
          });
          return NextResponse.json({ received: true });
        }

        const updatedPeriod = derivePeriodDates(data);

        await fetchProductMutation(anyApi.billing.upsertSubscription, {
          clerkOrganizationId: organizationId,
          dodoSubscriptionId: subscriptionId,
          dodoCustomerId: customerId,
          planId: plan.id,
          status: "active",
          monthlyTokenAllowance: plan.monthlyTokenAllowance,
          currentPeriodStart: updatedPeriod.periodStart,
          currentPeriodEnd: updatedPeriod.periodEnd,
        });

        logEvent("info", "billing.webhook.subscription_updated", {
          organizationId,
          planId: plan.id,
          allowance: plan.monthlyTokenAllowance,
          subscriptionId,
          periodStart: new Date(updatedPeriod.periodStart).toISOString(),
          periodEnd: new Date(updatedPeriod.periodEnd).toISOString(),
        });
        break;
      }

      default:
        logEvent("info", "billing.webhook.unhandled_event", {
          eventType,
          organizationId,
          subscriptionId,
        });
    }
  } catch (error) {
    logError("billing.webhook.processing_failed", error, {
      eventType,
      organizationId,
      subscriptionId,
    });
  }

  return NextResponse.json({ received: true });
}
