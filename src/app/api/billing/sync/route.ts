import { NextResponse } from "next/server";

import { anyApi } from "convex/server";
import { auth } from "@clerk/nextjs/server";

import { createErrorJsonResponse } from "@/lib/api";
import { PLAN_CONFIG, type PlanDefinition } from "@/lib/billing";
import { fetchProductMutation, fetchProductQuery } from "@/lib/convex";
import { getDodoBillingEnv, getDodoApiBase } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findPlanByProductId(productId: string): PlanDefinition | undefined {
  for (const plan of Object.values(PLAN_CONFIG)) {
    if (plan.dodoProductId && plan.dodoProductId === productId) return plan;
  }
  return undefined;
}

type DodoStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "on_hold"
  | "failed"
  | "pending";

function mapDodoStatus(
  dodoStatus: DodoStatus,
): "active" | "cancelled" | "expired" | "past_due" {
  switch (dodoStatus) {
    case "active":
      return "active";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "on_hold":
    case "failed":
    case "pending":
      return "past_due";
    default:
      return "cancelled";
  }
}

function parseTimestamp(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// ---------------------------------------------------------------------------
// POST /api/billing/sync
// ---------------------------------------------------------------------------

export async function POST() {
  try {
    const { orgId } = await auth();
    if (!orgId) throw new AppError("Authentication required.", 401);

    const billingEnv = getDodoBillingEnv();
    if (!billingEnv) {
      throw new AppError("Billing is not configured.", 503);
    }

    // Get the current subscription from Convex
    const subscription = await fetchProductQuery(
      anyApi.billing.getSubscriptionByOrg,
      { clerkOrganizationId: orgId },
    );

    if (!subscription?.dodoSubscriptionId) {
      // No subscription to sync — they're on Free
      return NextResponse.json({ synced: false, reason: "no_subscription" });
    }

    // Fetch the subscription from Dodo's API
    const dodoBase = getDodoApiBase();
    const res = await fetch(
      `${dodoBase}/subscriptions/${subscription.dodoSubscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${billingEnv.DODO_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      logError("billing.sync.dodo_api_failed", new Error(body), {
        organizationId: orgId,
        subscriptionId: subscription.dodoSubscriptionId,
        status: res.status,
      });
      throw new AppError("Failed to fetch subscription from Dodo.", 502);
    }

    const dodo = await res.json();

    const dodoStatus = mapDodoStatus(dodo.status);
    const plan = findPlanByProductId(dodo.product_id);
    const planId = plan?.id ?? subscription.planId;

    // Derive period dates from Dodo response
    const prev = parseTimestamp(dodo.previous_billing_date);
    const next = parseTimestamp(dodo.next_billing_date);
    let periodStart: number;
    let periodEnd: number;

    if (prev && next && next > prev) {
      periodStart = prev;
      periodEnd = next;
    } else {
      const anchor = parseTimestamp(dodo.created_at) ?? Date.now();
      const d = new Date(anchor);
      periodStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()).getTime();
    }

    const allowance =
      dodoStatus === "active"
        ? (plan?.monthlyTokenAllowance ?? subscription.monthlyTokenAllowance)
        : 0;

    await fetchProductMutation(anyApi.billing.upsertSubscription, {
      clerkOrganizationId: orgId,
      dodoSubscriptionId: subscription.dodoSubscriptionId,
      dodoCustomerId: dodo.customer?.customer_id ?? subscription.dodoCustomerId,
      planId,
      status: dodoStatus,
      monthlyTokenAllowance: allowance,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    logEvent("info", "billing.sync.completed", {
      organizationId: orgId,
      subscriptionId: subscription.dodoSubscriptionId,
      previousStatus: subscription.status,
      newStatus: dodoStatus,
      planId,
      allowance,
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
    });

    return NextResponse.json({
      synced: true,
      status: dodoStatus,
      planId,
    });
  } catch (error) {
    logError("billing.sync.failed", error);
    return createErrorJsonResponse(error);
  }
}
