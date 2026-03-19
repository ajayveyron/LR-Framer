import { NextResponse } from "next/server";

import { anyApi } from "convex/server";
import { auth } from "@clerk/nextjs/server";

import { createErrorJsonResponse } from "@/lib/api";
import { fetchProductQuery } from "@/lib/convex";
import { getDodoBillingEnv, getDodoApiBase } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { orgId, orgRole, userId } = await auth();

    if (!orgId || !userId) {
      throw new AppError("Authentication required.", 401);
    }

    if (orgRole !== "org:admin") {
      throw new AppError("Only organization admins can manage subscriptions.", 403);
    }

    const billingEnv = getDodoBillingEnv();
    if (!billingEnv) {
      throw new AppError("Billing is not configured.", 503);
    }

    const subscription = await fetchProductQuery(
      anyApi.billing.getSubscriptionByOrg,
      { clerkOrganizationId: orgId },
    );

    if (!subscription) {
      throw new AppError("No active subscription found for this organization.", 404);
    }

    const dodoBase = getDodoApiBase();
    const response = await fetch(
      `${dodoBase}/customers/${subscription.dodoCustomerId}/customer-portal/sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${billingEnv.DODO_API_KEY}`,
        },
        body: JSON.stringify({
          send_email: false,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      logError("billing.portal.dodo_api_failed", new Error(errorBody), {
        organizationId: orgId,
        userId,
        customerId: subscription.dodoCustomerId,
        status: response.status,
      });
      throw new AppError("Failed to create portal session.", 502);
    }

    const data = await response.json();
    const portalUrl = data.link ?? data.url;

    if (!portalUrl) {
      logError("billing.portal.no_url", new Error("Dodo response missing portal URL"), {
        organizationId: orgId,
        userId,
        customerId: subscription.dodoCustomerId,
        responseKeys: Object.keys(data),
      });
      throw new AppError("Failed to create portal session.", 502);
    }

    logEvent("info", "billing.portal.created", {
      organizationId: orgId,
      userId,
      customerId: subscription.dodoCustomerId,
      subscriptionId: subscription.dodoSubscriptionId,
    });

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    logError("billing.portal.failed", error);
    return createErrorJsonResponse(error);
  }
}
