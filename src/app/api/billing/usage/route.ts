import { NextResponse } from "next/server";

import { anyApi } from "convex/server";
import { auth } from "@clerk/nextjs/server";

import { createErrorJsonResponse } from "@/lib/api";
import {
  PLAN_CONFIG,
  calculateUsagePercent,
  getBillingCycleDates,
  getPlanById,
} from "@/lib/billing";
import { fetchProductQuery } from "@/lib/convex";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      throw new AppError("Authentication required.", 401);
    }

    const subscription = await fetchProductQuery(
      anyApi.billing.getSubscriptionByOrg,
      { clerkOrganizationId: orgId },
    );

    const plan = subscription
      ? getPlanById(subscription.planId) ?? PLAN_CONFIG.free
      : PLAN_CONFIG.free;

    const allowance = subscription?.monthlyTokenAllowance ?? plan.monthlyTokenAllowance;
    const { cycleStart, cycleEnd } = getBillingCycleDates(subscription);

    const [currentUsage, byFeature, byUser] = await Promise.all([
      fetchProductQuery(anyApi.billing.getOrgUsageForPeriod, {
        clerkOrganizationId: orgId,
        periodStart: cycleStart,
        periodEnd: cycleEnd,
      }),
      fetchProductQuery(anyApi.billing.getOrgUsageByFeature, {
        clerkOrganizationId: orgId,
        periodStart: cycleStart,
        periodEnd: cycleEnd,
      }),
      fetchProductQuery(anyApi.billing.getOrgUsageByUser, {
        clerkOrganizationId: orgId,
        periodStart: cycleStart,
        periodEnd: cycleEnd,
      }),
    ]);

    const percentUsed = calculateUsagePercent(currentUsage, allowance);

    logEvent("info", "billing.usage.queried", {
      organizationId: orgId,
      currentUsage,
      allowance,
      percentUsed,
      planName: plan.name,
    });

    return NextResponse.json({
      percentUsed,
      currentUsage,
      allowance,
      planName: plan.name,
      byFeature,
      byUser,
      cycleStart: new Date(cycleStart).toISOString(),
      cycleEnd: new Date(cycleEnd).toISOString(),
    });
  } catch (error) {
    logError("billing.usage.failed", error);
    return createErrorJsonResponse(error);
  }
}
