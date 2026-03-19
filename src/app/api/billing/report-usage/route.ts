import { NextResponse } from "next/server";

import { anyApi } from "convex/server";

import { reportMeteredUsage } from "@/lib/billing";
import { fetchProductQuery } from "@/lib/convex";
import { getDodoBillingEnv } from "@/lib/env";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/billing/report-usage
//
// Callable by cron or internal trigger. Iterates all active subscriptions and
// reports metered token usage to Dodo Payments for each org's billing period.
//
// Auth: Bearer token must match DODO_API_KEY (simple shared-secret check).
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const billingEnv = getDodoBillingEnv();
  if (!billingEnv) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 },
    );
  }

  // Simple auth: bearer token must match DODO_API_KEY
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== billingEnv.DODO_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logEvent("info", "billing.report_usage.started");

  try {
    const subscriptions = await fetchProductQuery(
      anyApi.billing.listActiveSubscriptions,
      {},
    );

    let reported = 0;
    let failed = 0;
    const errors: Array<{ organizationId: string; error: string }> = [];

    for (const sub of subscriptions) {
      try {
        const totalTokens = await fetchProductQuery(
          anyApi.billing.getOrgUsageForPeriod,
          {
            clerkOrganizationId: sub.clerkOrganizationId,
            periodStart: sub.currentPeriodStart,
            periodEnd: sub.currentPeriodEnd,
          },
        );

        await reportMeteredUsage({
          subscriptionId: sub.dodoSubscriptionId,
          organizationId: sub.clerkOrganizationId,
          totalTokens,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
        });

        reported++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push({ organizationId: sub.clerkOrganizationId, error: message });
        logError("billing.report_usage.org_failed", error, {
          organizationId: sub.clerkOrganizationId,
          subscriptionId: sub.dodoSubscriptionId,
        });
      }
    }

    logEvent("info", "billing.report_usage.completed", {
      totalSubscriptions: subscriptions.length,
      reported,
      failed,
    });

    return NextResponse.json({
      totalSubscriptions: subscriptions.length,
      reported,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logError("billing.report_usage.failed", error);
    return NextResponse.json(
      { error: "Failed to run usage report" },
      { status: 500 },
    );
  }
}
