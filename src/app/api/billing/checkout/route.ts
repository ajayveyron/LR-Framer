import { NextRequest, NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { createErrorJsonResponse } from "@/lib/api";
import { PLAN_CONFIG } from "@/lib/billing";
import { getDodoBillingEnv, getDodoApiBase } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "";

    if (!email) {
      throw new AppError("No email address found on your account.", 400);
    }

    const productId = PLAN_CONFIG.pro.dodoProductId;
    if (!productId) {
      throw new AppError("Pro plan product ID is not configured.", 503);
    }

    const dodoBase = getDodoApiBase();
    const response = await fetch(`${dodoBase}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${billingEnv.DODO_API_KEY}`,
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email, name },
        return_url: `${request.headers.get("origin") ?? "http://localhost:3000"}/dashboard/settings`,
        metadata: { clerkOrganizationId: orgId, clerkUserId: userId },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logError("billing.checkout.dodo_api_failed", new Error(errorBody), {
        organizationId: orgId,
        userId,
        status: response.status,
      });
      throw new AppError("Failed to create checkout session.", 502);
    }

    const data = await response.json();
    const checkoutUrl = data.checkout_url ?? data.payment_link ?? data.url;

    if (!checkoutUrl) {
      logError("billing.checkout.no_url", new Error("Dodo response missing checkout URL"), {
        organizationId: orgId,
        userId,
        responseKeys: Object.keys(data),
      });
      throw new AppError("Failed to create checkout session.", 502);
    }

    logEvent("info", "billing.checkout.created", {
      organizationId: orgId,
      userId,
      planId: PLAN_CONFIG.pro.id,
      productId,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    logError("billing.checkout.failed", error);
    return createErrorJsonResponse(error);
  }
}
