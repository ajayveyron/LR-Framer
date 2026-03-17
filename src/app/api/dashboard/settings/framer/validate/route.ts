import { NextResponse } from "next/server";

import { createErrorJsonResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { validateFramerConnection } from "@/lib/framer-onboarding";
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
      projectInput?: string;
    };

    const projectInput =
      body.projectInput?.trim() || site.framerProjectUrl || site.framerProjectId;
    if (!projectInput) {
      throw new AppError("Framer project URL or ID is required.", 400);
    }

    const result = await validateFramerConnection({
      apiKey: resolveSubmittedOrStoredApiKey(site, body.apiKey),
      projectInput,
    });

    logEvent("info", "product.settings.validateFramer.succeeded", {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      collectionCount: result.collections.length,
      projectId: result.projectId,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError("product.settings.validateFramer.failed", error);
    return createErrorJsonResponse(error);
  }
}
