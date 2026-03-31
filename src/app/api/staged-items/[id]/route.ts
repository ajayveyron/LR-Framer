import { NextResponse } from "next/server";
import { anyApi } from "convex/server";

import { createErrorJsonResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logEvent, logError } from "@/lib/logger";
import { fetchProductMutation } from "@/lib/convex";
import { requireDashboardApiAccess } from "@/lib/product-access";

export const runtime = "nodejs";

/** DELETE — remove a staged item (discard) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId } = await requireDashboardApiAccess();
    const { id } = await params;
    if (!id) throw new AppError("id is required", 400);

    await fetchProductMutation(anyApi.stagedItems.remove, { id, clerkOrganizationId: organizationId });

    logEvent("info", "staged_items.removed", { stagedItemId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("staged_items.remove.failed", error);
    return createErrorJsonResponse(error);
  }
}

/** PATCH — update a staged item's fields */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId } = await requireDashboardApiAccess();
    const { id } = await params;
    if (!id) throw new AppError("id is required", 400);

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.slug !== undefined) {
      const trimmedSlug = String(body.slug).trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
        throw new AppError(
          "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
          400,
        );
      }
      updates.slug = trimmedSlug;
    }
    if (body.draft !== undefined) updates.draft = body.draft;
    if (body.fieldData !== undefined) updates.fieldDataJson = JSON.stringify(body.fieldData);

    await fetchProductMutation(anyApi.stagedItems.update, { id, clerkOrganizationId: organizationId, ...updates });

    logEvent("info", "staged_items.updated", { stagedItemId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("staged_items.update.failed", error);
    return createErrorJsonResponse(error);
  }
}
