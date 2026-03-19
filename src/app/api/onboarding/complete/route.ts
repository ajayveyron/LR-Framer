import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { anyApi } from "convex/server";

import { createErrorJsonResponse } from "@/lib/api";
import { fetchProductMutation } from "@/lib/convex";
import { encryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { getBlogMetadata } from "@/lib/framer";
import { validateFramerConnection } from "@/lib/framer-onboarding";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";
import { logError, logEvent } from "@/lib/logger";
import { getProductEnvIssues } from "@/lib/product-env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const issues = getProductEnvIssues();
    if (issues.length > 0) {
      throw new AppError(
        "FramerLink is missing required product environment variables.",
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
      throw new AppError("Only admins can finish onboarding.", 403);
    }

    const body = (await request.json()) as {
      apiKey?: string;
      collectionId?: string;
      projectInput?: string;
      siteName?: string;
    };

    const validation = await validateFramerConnection({
      apiKey: body.apiKey ?? "",
      projectInput: body.projectInput ?? "",
    });
    const collection = validation.collections.find(
      (entry) => entry.id === body.collectionId,
    );

    if (!collection) {
      throw new AppError(
        "Choose one of the validated user-managed collections before continuing.",
        400,
      );
    }

    const metadata = await runWithFramerRuntimeContext(
      {
        apiKey: body.apiKey?.trim() ?? "",
        collectionId: collection.id,
        collectionName: collection.name,
        projectId: validation.projectId,
      },
      () => getBlogMetadata(),
    );

    // --- Framer project uniqueness enforcement (Tasks 12.1 & 12.2) ---

    // 1. Release any existing claim for this org (idempotent — no-op if none)
    await fetchProductMutation(anyApi.billing.releaseFramerProject, {
      clerkOrganizationId: orgId,
    });

    logEvent("info", "billing.framer_claim.released", {
      clerkOrganizationId: orgId,
    });

    // 2. Claim the new project
    const claimResult = await fetchProductMutation(
      anyApi.billing.claimFramerProject,
      {
        framerProjectId: validation.projectId,
        clerkOrganizationId: orgId,
      },
    );

    // 3. If claim fails (another org has it), reject with 409
    if (!claimResult.claimed) {
      logEvent("warn", "billing.framer_claim.rejected", {
        clerkOrganizationId: orgId,
        framerProjectId: validation.projectId,
        claimedByOrg: claimResult.claimedByOrg,
      });

      throw new AppError(
        "This Framer project is already connected to another organization.",
        409,
      );
    }

    // 4. Claim succeeded — log and proceed
    logEvent("info", "billing.framer_claim.claimed", {
      clerkOrganizationId: orgId,
      framerProjectId: validation.projectId,
    });

    await fetchProductMutation(anyApi.product.saveSiteSetup, {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      encryptedFramerApiKey: encryptSecret(body.apiKey?.trim() ?? ""),
      framerCollectionId: collection.id,
      framerCollectionName: collection.name,
      framerMetadataJson: JSON.stringify(metadata),
      framerProjectId: validation.projectId,
      framerProjectUrl: validation.projectUrl,
      siteName: body.siteName?.trim() || "My FramerLink Team",
    });

    logEvent("info", "product.onboarding.complete.succeeded", {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      collectionId: collection.id,
      projectId: validation.projectId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("product.onboarding.complete.failed", error);
    return createErrorJsonResponse(error);
  }
}
