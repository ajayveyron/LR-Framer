import { NextResponse } from "next/server";
import { anyApi } from "convex/server";

import { createErrorJsonResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logEvent, logError } from "@/lib/logger";
import { fetchProductMutation, fetchProductQuery } from "@/lib/convex";
import { requireDashboardApiAccess } from "@/lib/product-access";

export const runtime = "nodejs";

/** GET — list staged items for the current org + collection */
export async function GET(request: Request) {
  try {
    const access = await requireDashboardApiAccess();
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collectionId");
    if (!collectionId) throw new AppError("collectionId is required", 400);

    const items = await fetchProductQuery(
      anyApi.stagedItems.listByCollection,
      {
        clerkOrganizationId: access.organizationId,
        collectionId,
      },
    );

    return NextResponse.json({ items });
  } catch (error) {
    logError("staged_items.list.failed", error);
    return createErrorJsonResponse(error);
  }
}

/** POST — create a staged item */
export async function POST(request: Request) {
  try {
    const access = await requireDashboardApiAccess();
    const body = await request.json();

    const { collectionId, slug, draft, fieldData, source } = body as {
      collectionId: string;
      slug: string;
      draft: boolean;
      fieldData: Record<string, unknown>;
      source?: "ai" | "manual";
    };

    if (!collectionId || !slug) {
      throw new AppError("collectionId and slug are required", 400);
    }

    const id = await fetchProductMutation(anyApi.stagedItems.create, {
      clerkOrganizationId: access.organizationId,
      collectionId,
      slug,
      draft: draft ?? true,
      fieldDataJson: JSON.stringify(fieldData ?? {}),
      createdByUserId: access.userId,
      source: source ?? "ai",
    });

    logEvent("info", "staged_items.created", {
      stagedItemId: id,
      collectionId,
      slug,
      source: source ?? "ai",
    });

    return NextResponse.json({ id, slug });
  } catch (error) {
    logError("staged_items.create.failed", error);
    return createErrorJsonResponse(error);
  }
}
