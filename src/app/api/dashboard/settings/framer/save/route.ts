import { NextResponse } from "next/server";

import { anyApi } from "convex/server";

import { createErrorJsonResponse } from "@/lib/api";
import { fetchProductMutation } from "@/lib/convex";
import { encryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { getBlogMetadata } from "@/lib/framer";
import { validateFramerConnection } from "@/lib/framer-onboarding";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";
import { logError, logEvent } from "@/lib/logger";
import {
  requireSiteSettingsAdminAccess,
  resolveSubmittedOrStoredApiKey,
} from "@/lib/product-settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { orgId, site, userId } = await requireSiteSettingsAdminAccess();
    const body = (await request.json()) as {
      apiKey?: string;
      collectionId?: string;
      projectInput?: string;
    };

    const projectInput =
      body.projectInput?.trim() || site.framerProjectUrl || site.framerProjectId;
    if (!projectInput) {
      throw new AppError("Framer project URL or ID is required.", 400);
    }

    const apiKey = resolveSubmittedOrStoredApiKey(site, body.apiKey);
    const validation = await validateFramerConnection({
      apiKey,
      projectInput,
    });
    const collection = validation.collections.find(
      (entry) => entry.id === body.collectionId,
    );

    if (!collection) {
      throw new AppError(
        "Choose one of the validated user-managed collections before saving.",
        400,
      );
    }

    const metadata = await runWithFramerRuntimeContext(
      {
        apiKey,
        collectionId: collection.id,
        collectionName: collection.name,
        projectId: validation.projectId,
      },
      () => getBlogMetadata(),
    );

    await fetchProductMutation(anyApi.product.saveSiteSetup, {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      encryptedFramerApiKey: encryptSecret(apiKey),
      framerCollectionId: collection.id,
      framerCollectionName: collection.name,
      framerMetadataJson: JSON.stringify(metadata),
      framerProjectId: validation.projectId,
      framerProjectUrl: validation.projectUrl,
      siteName: site.name,
    });

    logEvent("info", "product.settings.saveFramer.succeeded", {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      collectionId: collection.id,
      projectId: validation.projectId,
    });

    return NextResponse.json({
      collectionId: collection.id,
      collectionName: collection.name,
      ok: true,
      projectId: validation.projectId,
      projectUrl: validation.projectUrl,
    });
  } catch (error) {
    logError("product.settings.saveFramer.failed", error);
    return createErrorJsonResponse(error);
  }
}
