import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { anyApi } from "convex/server";

import { createErrorJsonResponse } from "@/lib/api";
import { fetchProductMutation } from "@/lib/convex";
import { AppError } from "@/lib/errors";
import { validateFramerConnection } from "@/lib/framer-onboarding";
import { logError, logEvent } from "@/lib/logger";
import { getProductEnvIssues } from "@/lib/product-env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const issues = getProductEnvIssues();
    if (issues.length > 0) {
      throw new AppError(
        "Framer Bot is missing required product environment variables.",
        503,
        { fieldErrors: issues },
      );
    }

    const { orgId, orgRole, userId } = await auth();
    if (!userId) {
      throw new AppError("Sign in to continue onboarding.", 401);
    }

    if (!orgId) {
      throw new AppError("Create your team before connecting Framer.", 400);
    }

    if (orgRole !== "org:admin") {
      throw new AppError("Only admins can connect Framer.", 403);
    }

    const body = (await request.json()) as {
      apiKey?: string;
      projectInput?: string;
    };

    const result = await validateFramerConnection({
      apiKey: body.apiKey ?? "",
      projectInput: body.projectInput ?? "",
    });

    await fetchProductMutation(anyApi.product.saveValidatedFramerDraft, {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      projectId: result.projectId,
      projectUrl: result.projectUrl,
    });

    logEvent("info", "product.onboarding.validateFramer.succeeded", {
      collectionCount: result.collections.length,
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      projectId: result.projectId,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError("product.onboarding.validateFramer.failed", error);
    return createErrorJsonResponse(error);
  }
}
