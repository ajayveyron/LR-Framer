import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { createErrorJsonResponse } from "@/lib/api";
import { getDodoBillingEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logEvent } from "@/lib/logger";

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

    // Dodo customer portal uses a static link per business.
    // Test: https://test.customer.dodopayments.com/login/{business_id}
    // Live: https://customer.dodopayments.com/login/{business_id}
    const testMode = process.env.DODO_TEST_MODE === "true" || process.env.DODO_TEST_MODE === "1";
    const portalBase = testMode
      ? "https://test.customer.dodopayments.com"
      : "https://customer.dodopayments.com";
    const portalUrl = `${portalBase}/login/${billingEnv.DODO_BUSINESS_ID}`;

    logEvent("info", "billing.portal.redirect", {
      organizationId: orgId,
      userId,
      businessId: billingEnv.DODO_BUSINESS_ID,
    });

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}
