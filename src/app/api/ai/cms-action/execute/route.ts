import { NextResponse } from "next/server";
import { z } from "zod";

import { createErrorJsonResponse } from "@/lib/api";
import { invalidateAIContextSnapshot } from "@/lib/ai-context-snapshot";
import { AppError } from "@/lib/errors";
import { logEvent, logError } from "@/lib/logger";
import { normalizeFieldData } from "@/lib/normalize-field-data";
import {
  addCollectionItems,
  removeCollectionItems,
  removeCollectionItem,
  setCollectionItemAttributes,
  addEnumCase,
  getAllCollections,
  updateEnumCase,
  removeEnumCase,
  setEnumCaseOrder,
  publishSite,
} from "@/lib/framer";
import {
  getSiteFramerRuntimeContext,
  requireDashboardApiAccess,
} from "@/lib/product-access";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";

export const runtime = "nodejs";

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_items"),
    collectionId: z.string(),
    items: z.array(
      z.object({
        id: z.string().optional(),
        slug: z.string(),
        draft: z.boolean().optional(),
        fieldData: z.record(z.string(), z.object({ type: z.string(), value: z.unknown() })).optional(),
      }),
    ),
  }),
  z.object({
    action: z.literal("remove_items"),
    collectionId: z.string(),
    itemIds: z.array(z.string()),
  }),
  z.object({
    action: z.literal("remove_item"),
    collectionId: z.string(),
    itemId: z.string(),
  }),
  z.object({
    action: z.literal("set_item_attributes"),
    collectionId: z.string(),
    itemId: z.string(),
    slug: z.string().optional(),
    draft: z.boolean().optional(),
    fieldData: z.record(z.string(), z.object({ type: z.string(), value: z.unknown() })).optional(),
  }),
  z.object({
    action: z.literal("add_enum_case"),
    collectionId: z.string(),
    fieldId: z.string(),
    name: z.string(),
  }),
  z.object({
    action: z.literal("update_enum_case"),
    collectionId: z.string(),
    fieldId: z.string(),
    caseId: z.string(),
    newName: z.string(),
  }),
  z.object({
    action: z.literal("remove_enum_case"),
    collectionId: z.string(),
    fieldId: z.string(),
    caseId: z.string(),
  }),
  z.object({
    action: z.literal("set_enum_case_order"),
    collectionId: z.string(),
    fieldId: z.string(),
    caseIds: z.array(z.string()),
  }),
  z.object({ action: z.literal("publish") }),
]);

export async function POST(request: Request) {
  const startMs = Date.now();

  try {
    const access = await requireDashboardApiAccess();
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError("Invalid action payload: " + parsed.error.message, 400);
    }

    const payload = parsed.data;
    const baseContext = getSiteFramerRuntimeContext(access.site);
    const runInFramerContext = <T,>(fn: () => Promise<T>) =>
      runWithFramerRuntimeContext(baseContext, fn);

    if ("collectionId" in payload) {
      const collections = await runInFramerContext(() => getAllCollections());
      const allowedCollectionIds = new Set(
        collections
          .filter((collection) => collection.managedBy === "user")
          .map((collection) => collection.id),
      );

      if (!allowedCollectionIds.has(payload.collectionId)) {
        throw new AppError("Invalid collection for the current site.", 400);
      }
    }

    logEvent("info", "ai.cms_action.execute", {
      action: payload.action,
      fieldDataNormalized: "fieldData" in payload && !!payload.fieldData,
    });

    let result: unknown;

    switch (payload.action) {
      case "add_items":
        result = await runInFramerContext(() =>
          addCollectionItems(
            payload.collectionId,
            payload.items.map((item) => ({
              ...item,
              fieldData: item.fieldData ? normalizeFieldData(item.fieldData) : undefined,
            })),
          ),
        );
        break;
      case "remove_items":
        result = await runInFramerContext(() =>
          removeCollectionItems(payload.collectionId, payload.itemIds),
        );
        break;
      case "remove_item":
        result = await runInFramerContext(() =>
          removeCollectionItem(payload.collectionId, payload.itemId),
        );
        break;
      case "set_item_attributes": {
        const attrs: Record<string, unknown> = {};
        if (payload.slug !== undefined) attrs.slug = payload.slug;
        if (payload.draft !== undefined) attrs.draft = payload.draft;
        if (payload.fieldData) attrs.fieldData = normalizeFieldData(payload.fieldData);
        result = await runInFramerContext(() =>
          setCollectionItemAttributes(
            payload.collectionId,
            payload.itemId,
            attrs as Parameters<typeof setCollectionItemAttributes>[2],
          ),
        );
        break;
      }
      case "add_enum_case":
        result = await runInFramerContext(() =>
          addEnumCase(payload.collectionId, payload.fieldId, payload.name),
        );
        break;
      case "update_enum_case":
        result = await runInFramerContext(() =>
          updateEnumCase(
            payload.collectionId,
            payload.fieldId,
            payload.caseId,
            payload.newName,
          ),
        );
        break;
      case "remove_enum_case":
        result = await runInFramerContext(() =>
          removeEnumCase(payload.collectionId, payload.fieldId, payload.caseId),
        );
        break;
      case "set_enum_case_order":
        result = await runInFramerContext(() =>
          setEnumCaseOrder(payload.collectionId, payload.fieldId, payload.caseIds),
        );
        break;
      case "publish":
        result = await runInFramerContext(() => publishSite());
        break;
    }

    if (
      payload.action === "add_enum_case" ||
      payload.action === "update_enum_case" ||
      payload.action === "remove_enum_case" ||
      payload.action === "set_enum_case_order"
    ) {
      const snapshotCacheKey = access.site.framerProjectId
        ? `framer-project:${access.site.framerProjectId}`
        : `org:${access.organizationId}`;
      invalidateAIContextSnapshot(snapshotCacheKey);
    }

    logEvent("info", "ai.cms_action.success", {
      action: payload.action,
      durationMs: Date.now() - startMs,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    logError("ai.cms_action.failed", error);
    return createErrorJsonResponse(error);
  }
}
