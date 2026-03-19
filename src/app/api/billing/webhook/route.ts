import { NextResponse } from "next/server";

import { anyApi } from "convex/server";

import {
  PLAN_CONFIG,
  type PlanDefinition,
  verifyDodoWebhookSignature,
} from "@/lib/billing";
import { fetchProductMutation } from "@/lib/convex";
import { getDodoBillingEnv } from "@/lib/env";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

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
    current_period_start?: string;
    current_period_end?: string;
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

function parsePeriodTimestamp(iso: string | undefined): number {
  if (!iso) return Date.now();
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
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

        await fetchProductMutation(anyApi.billing.upsertSubscription, {
          clerkOrganizationId: organizationId,
          dodoSubscriptionId: subscriptionId,
          dodoCustomerId: customerId,
          planId: plan.id,
          status: "active",
          monthlyTokenAllowance: plan.monthlyTokenAllowance,
          currentPeriodStart: parsePeriodTimestamp(
            data.current_period_start as string | undefined,
          ),
          currentPeriodEnd: parsePeriodTimestamp(
            data.current_period_end as string | undefined,
          ),
        });

        logEvent("info", "billing.webhook.subscription_activated", {
          organizationId,
          planId: plan.id,
          allowance: plan.monthlyTokenAllowance,
          subscriptionId,
        });
        break;
      }

      case "subscription.cancelled":
      case "subscription.expired": {
        const status =
          eventType === "subscription.cancelled" ? "cancelled" : "expired";
        const plan = findPlanByProductId(productId);
        const planId = plan?.id ?? "unknown";

        await fetchProductMutation(anyApi.billing.upsertSubscription, {
          clerkOrganizationId: organizationId,
          dodoSubscriptionId: subscriptionId,
          dodoCustomerId: customerId,
          planId,
          status,
          monthlyTokenAllowance: 0,
          currentPeriodStart: parsePeriodTimestamp(
            data.current_period_start as string | undefined,
          ),
          currentPeriodEnd: parsePeriodTimestamp(
            data.current_period_end as string | undefined,
          ),
        });

        logEvent("info", `billing.webhook.subscription_${status}`, {
          organizationId,
          planId,
          subscriptionId,
        });
        break;
      }

      case "subscription.updated": {
        const plan = findPlanByProductId(productId);
        if (!plan) {
          logError("billing.webhook.unknown_plan", new Error("Unknown plan ID"), {
            productId,
            eventType,
            organizationId,
          });
          return NextResponse.json({ received: true });
        }

        await fetchProductMutation(anyApi.billing.upsertSubscription, {
          clerkOrganizationId: organizationId,
          dodoSubscriptionId: subscriptionId,
          dodoCustomerId: customerId,
          planId: plan.id,
          status: "active",
          monthlyTokenAllowance: plan.monthlyTokenAllowance,
          currentPeriodStart: parsePeriodTimestamp(
            data.current_period_start as string | undefined,
          ),
          currentPeriodEnd: parsePeriodTimestamp(
            data.current_period_end as string | undefined,
          ),
        });

        logEvent("info", "billing.webhook.subscription_updated", {
          organizationId,
          planId: plan.id,
          allowance: plan.monthlyTokenAllowance,
          subscriptionId,
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
