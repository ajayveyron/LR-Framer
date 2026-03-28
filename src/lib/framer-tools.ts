import { tool } from "ai";
import { z } from "zod";
import { anyApi } from "convex/server";

import { invalidateAIContextSnapshot } from "@/lib/ai-context-snapshot";
import { extractImageJobId } from "@/lib/ai-image-placeholders";
import { attachImageJobToStagedItem } from "@/lib/ai-image-tool";
import {
  formatAddItemsValidationError,
  validateAddItemsAction,
} from "@/lib/cms-action-validation";
import {
  addCollectionItems,
  addEnumCase,
  getAllCollections,
  getCollectionById,
  getCollectionFields,
  getCollectionItems,
  getEnumFieldCases,
  getProjectInfo,
  getPublishInfo,
  publishSite,
  removeCollectionItem,
  removeCollectionItems,
  removeEnumCase,
  setCollectionAsActive,
  setCollectionItemAttributes,
  setEnumCaseOrder,
  updateEnumCase,
} from "@/lib/framer";
import { logEvent, logError } from "@/lib/logger";
import { normalizeFieldData } from "@/lib/normalize-field-data";
import { fetchProductMutation } from "@/lib/convex";

const MAX_TOOL_RESULT_BYTES = 500_000;

type RunInFramerContext = <T>(fn: () => Promise<T>) => Promise<T>;

function wrapExecute<T>(
  event: string,
  fn: () => Promise<T>,
  meta: Record<string, unknown> = {},
  runInFramerContext?: RunInFramerContext,
): Promise<T | { _truncated: true; itemCount?: number; preview: string }> {
  logEvent("info", `ai.tool.${event}.called`, meta);
  const execute = runInFramerContext ? () => runInFramerContext(fn) : fn;

  return execute()
    .then((result) => {
      const serialized = JSON.stringify(result);
      if (serialized.length > MAX_TOOL_RESULT_BYTES) {
        logEvent("warn", `ai.tool.${event}.result_truncated`, {
          ...meta,
          originalSize: serialized.length,
          maxSize: MAX_TOOL_RESULT_BYTES,
        });
        return {
          _truncated: true,
          itemCount: Array.isArray(result) ? result.length : undefined,
          preview: serialized.slice(0, MAX_TOOL_RESULT_BYTES) + "…",
        } as const;
      }
      return result;
    })
    .catch((error) => {
      logError(`ai.tool.${event}.failed`, error, meta);
      throw error;
    });
}

const cmsActionPayloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_items"),
    collectionId: z.string().describe("The ID of the collection"),
    items: z
      .array(
        z.object({
          id: z
            .string()
            .optional()
            .describe("Existing item ID to update (omit for new items)"),
          slug: z.string().describe("Unique slug for the item"),
          draft: z.boolean().optional().describe("Whether the item is a draft"),
          fieldData: z
            .record(
              z.string(),
              z.object({ type: z.string(), value: z.unknown() }),
            )
            .optional(),
        }),
      )
      .describe("Items to add or upsert"),
  }),
  z.object({
    action: z.literal("remove_items"),
    collectionId: z.string().describe("The ID of the collection"),
    itemIds: z.array(z.string()).describe("Array of item IDs to remove"),
  }),
  z.object({
    action: z.literal("remove_item"),
    collectionId: z.string().describe("The ID of the collection"),
    itemId: z.string().describe("The ID of the item to remove"),
  }),
  z.object({
    action: z.literal("set_item_attributes"),
    collectionId: z.string().describe("The ID of the collection"),
    itemId: z.string().describe("The ID of the item to update"),
    slug: z.string().optional().describe("New slug value"),
    draft: z.boolean().optional().describe("New draft status"),
    fieldData: z
      .record(z.string(), z.object({ type: z.string(), value: z.unknown() }))
      .optional(),
  }),
  z.object({
    action: z.literal("add_enum_case"),
    collectionId: z.string().describe("The ID of the collection"),
    fieldId: z.string().describe("The ID of the enum field"),
    name: z.string().describe("Display name for the new enum case"),
  }),
  z.object({
    action: z.literal("update_enum_case"),
    collectionId: z.string().describe("The ID of the collection"),
    fieldId: z.string().describe("The ID of the enum field"),
    caseId: z.string().describe("The ID of the enum case to update"),
    newName: z.string().describe("The new display name"),
  }),
  z.object({
    action: z.literal("remove_enum_case"),
    collectionId: z.string().describe("The ID of the collection"),
    fieldId: z.string().describe("The ID of the enum field"),
    caseId: z.string().describe("The ID of the enum case to remove"),
  }),
  z.object({
    action: z.literal("set_enum_case_order"),
    collectionId: z.string().describe("The ID of the collection"),
    fieldId: z.string().describe("The ID of the enum field"),
    caseIds: z.array(z.string()).describe("Case IDs in the desired order"),
  }),
  z.object({ action: z.literal("publish") }),
]);

function buildFramerTools(runInFramerContext?: RunInFramerContext, stagingContext?: { organizationId: string; userId: string }) {
  const framerGetProjectInfo = tool({
    description: "Get the Framer project name and hashed project ID.",
    inputSchema: z.object({}),
    execute: () =>
      wrapExecute("getProjectInfo", getProjectInfo, {}, runInFramerContext),
  });

  const framerGetPublishInfo = tool({
    description:
      "Get publish/deployment info for both staging and production environments. Returns deployment time, URL, and optimization status for each.",
    inputSchema: z.object({}),
    execute: () =>
      wrapExecute("getPublishInfo", getPublishInfo, {}, runInFramerContext),
  });

  const framerPublish = tool({
    description:
      "Publish the Framer site. Creates a new deployment and returns the deployment ID, creation time, and hostnames.",
    inputSchema: z.object({}),
    execute: () => wrapExecute("publish", publishSite, {}, runInFramerContext),
  });

  const framerGetCollections = tool({
    description:
      "List all CMS collections in the Framer project. Returns each collection's ID, name, managedBy status, readonly flag, and slug field info.",
    inputSchema: z.object({}),
    execute: () =>
      wrapExecute("getCollections", getAllCollections, {}, runInFramerContext),
  });

  const framerGetCollection = tool({
    description:
      "Get a specific CMS collection by its ID. Returns the collection's metadata including name, managedBy, readonly, and slug field info.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection to retrieve"),
    }),
    execute: ({ collectionId }) =>
      wrapExecute(
        "getCollection",
        () => getCollectionById(collectionId),
        { collectionId },
        runInFramerContext,
      ),
  });

  const framerGetCollectionFields = tool({
    description:
      "Get all fields defined on a CMS collection. Returns each field's ID, name, type, required status, and for enum fields their cases.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
    }),
    execute: ({ collectionId }) =>
      wrapExecute(
        "getCollectionFields",
        () => getCollectionFields(collectionId),
        { collectionId },
        runInFramerContext,
      ),
  });

  const framerGetCollectionItems = tool({
    description:
      "Get all items (rows) in a CMS collection. Returns each item's ID, slug, draft status, and field data.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
    }),
    execute: ({ collectionId }) =>
      wrapExecute(
        "getCollectionItems",
        () => getCollectionItems(collectionId),
        { collectionId },
        runInFramerContext,
      ),
  });

  const framerAddCollectionItems = tool({
    description:
      "Add new items to a CMS collection, or update existing ones if an ID is provided. Each item needs a slug and optionally fieldData with typed entries like { type: 'string', value: 'hello' }.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      items: z
        .array(
          z.object({
            id: z
              .string()
              .optional()
              .describe("Existing item ID to update (omit for new items)"),
            slug: z.string().describe("Unique slug for the item"),
            draft: z
              .boolean()
              .optional()
              .describe("Whether the item is a draft"),
            fieldData: z
              .record(
                z.string(),
                z.object({
                  type: z
                    .string()
                    .describe(
                      "Field type (string, number, boolean, formattedText, date, enum, image, file, link, color, collectionReference, multiCollectionReference)",
                    ),
                  value: z.unknown().describe("The value for the field"),
                }),
              )
              .optional()
              .describe("Field data keyed by field ID"),
          }),
        )
        .describe("Array of items to add or upsert"),
    }),
    execute: ({ collectionId, items }) =>
      wrapExecute(
        "addCollectionItems",
        () => addCollectionItems(collectionId, items),
        { collectionId, itemCount: items.length },
        runInFramerContext,
      ),
  });

  const framerRemoveCollectionItems = tool({
    description: "Remove multiple items from a CMS collection by their IDs.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      itemIds: z.array(z.string()).describe("Array of item IDs to remove"),
    }),
    execute: ({ collectionId, itemIds }) =>
      wrapExecute(
        "removeCollectionItems",
        () => removeCollectionItems(collectionId, itemIds),
        { collectionId, removedCount: itemIds.length },
        runInFramerContext,
      ),
  });

  const framerSetItemAttributes = tool({
    description:
      "Update a single collection item's slug, draft status, or field data. Provide only the attributes you want to change.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      itemId: z.string().describe("The ID of the item to update"),
      slug: z.string().optional().describe("New slug value"),
      draft: z.boolean().optional().describe("New draft status"),
      fieldData: z
        .record(
          z.string(),
          z.object({
            type: z.string().describe("Field type"),
            value: z.unknown().describe("New value"),
          }),
        )
        .optional()
        .describe("Field data to update, keyed by field ID"),
    }),
    execute: ({ collectionId, itemId, slug, draft, fieldData }) =>
      wrapExecute(
        "setItemAttributes",
        () =>
          setCollectionItemAttributes(collectionId, itemId, {
            ...(slug !== undefined ? { slug } : {}),
            ...(draft !== undefined ? { draft } : {}),
            ...(fieldData ? { fieldData } : {}),
          }),
        { collectionId, itemId },
        runInFramerContext,
      ),
  });

  const framerRemoveItem = tool({
    description: "Remove a single item from a CMS collection.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      itemId: z.string().describe("The ID of the item to remove"),
    }),
    execute: ({ collectionId, itemId }) =>
      wrapExecute(
        "removeItem",
        () => removeCollectionItem(collectionId, itemId),
        { collectionId, itemId },
        runInFramerContext,
      ),
  });

  const framerGetEnumCases = tool({
    description: "Get all cases (options) for an enum field in a collection.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      fieldId: z.string().describe("The ID of the enum field"),
    }),
    execute: ({ collectionId, fieldId }) =>
      wrapExecute(
        "getEnumCases",
        () => getEnumFieldCases(collectionId, fieldId),
        { collectionId, fieldId },
        runInFramerContext,
      ),
  });

  const framerAddEnumCase = tool({
    description: "Add a new case (option) to an enum field.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      fieldId: z.string().describe("The ID of the enum field"),
      name: z.string().describe("Display name for the new enum case"),
    }),
    execute: ({ collectionId, fieldId, name }) =>
      wrapExecute(
        "addEnumCase",
        () => addEnumCase(collectionId, fieldId, name),
        { collectionId, fieldId, caseName: name },
        runInFramerContext,
      ),
  });

  const framerSetEnumCaseOrder = tool({
    description:
      "Reorder the cases of an enum field by providing case IDs in the desired order.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      fieldId: z.string().describe("The ID of the enum field"),
      caseIds: z
        .array(z.string())
        .describe("Array of case IDs in the desired order"),
    }),
    execute: ({ collectionId, fieldId, caseIds }) =>
      wrapExecute(
        "setEnumCaseOrder",
        () => setEnumCaseOrder(collectionId, fieldId, caseIds),
        { collectionId, fieldId },
        runInFramerContext,
      ),
  });

  const framerUpdateEnumCase = tool({
    description: "Rename an existing enum case.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      fieldId: z.string().describe("The ID of the enum field"),
      caseId: z.string().describe("The ID of the enum case to update"),
      newName: z.string().describe("The new display name for the case"),
    }),
    execute: ({ collectionId, fieldId, caseId, newName }) =>
      wrapExecute(
        "updateEnumCase",
        () => updateEnumCase(collectionId, fieldId, caseId, newName),
        { collectionId, fieldId, caseId },
        runInFramerContext,
      ),
  });

  const framerRemoveEnumCase = tool({
    description: "Remove an enum case from an enum field.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection"),
      fieldId: z.string().describe("The ID of the enum field"),
      caseId: z.string().describe("The ID of the enum case to remove"),
    }),
    execute: ({ collectionId, fieldId, caseId }) =>
      wrapExecute(
        "removeEnumCase",
        () => removeEnumCase(collectionId, fieldId, caseId),
        { collectionId, fieldId, caseId },
        runInFramerContext,
      ),
  });

  const framerSetCollectionAsActive = tool({
    description:
      "Set a collection as the active/selected collection in the Framer UI.",
    inputSchema: z.object({
      collectionId: z.string().describe("The ID of the collection to activate"),
    }),
    execute: ({ collectionId }) =>
      wrapExecute(
        "setCollectionAsActive",
        () => setCollectionAsActive(collectionId),
        { collectionId },
        runInFramerContext,
      ),
  });

  const proposeCmsAction = tool({
    description:
      "Propose a CMS write operation that requires user confirmation before executing. " +
      "Use this for ALL mutations: adding/removing/updating items, enum cases, and publishing. " +
      "The user will see a confirmation card and must approve before the action runs. " +
      "After approval, the action executes and you receive the result — use it to inform the user.",
    inputSchema: z.object({
      description: z
        .string()
        .describe("Human-readable summary of what this action does and why"),
      payload: cmsActionPayloadSchema.describe(
        "The action payload to execute if approved",
      ),
    }),
    needsApproval: true,
    execute: async ({ description, payload }) => {
      const startMs = Date.now();
      logEvent("info", "ai.cms_action.execute", {
        action: payload.action,
        description,
      });

      try {
        // Validate collection access
        if ("collectionId" in payload) {
          const collections = await (runInFramerContext
            ? runInFramerContext(() => getAllCollections())
            : getAllCollections());
          const allowed = new Set(
            collections
              .filter((c) => c.managedBy === "user")
              .map((c) => c.id),
          );
          if (!allowed.has(payload.collectionId)) {
            return { success: false, error: "Invalid collection for the current site." };
          }
        }

        let result: unknown;

        switch (payload.action) {
          case "add_items": {
            const fields = await (runInFramerContext
              ? runInFramerContext(() => getCollectionFields(payload.collectionId))
              : getCollectionFields(payload.collectionId));
            const validation = validateAddItemsAction(payload, fields);
            if (validation.blockingIssues.length > 0) {
              return {
                success: false,
                action: payload.action,
                error: formatAddItemsValidationError(validation),
              };
            }

            // Stage items in Convex instead of pushing directly to Framer
            if (stagingContext) {
              const stagedItems: Array<{
                id: string;
                stagedId: string;
                slug: string;
                draft: boolean;
                fieldData?: typeof payload.items[number]["fieldData"];
              }> = [];
              for (const item of payload.items) {
                const fieldValues: Record<string, unknown> = {};
                const pendingImageTargets: Array<{
                  jobId: string;
                  fieldId: string;
                }> = [];
                if (item.fieldData) {
                  for (const [key, entry] of Object.entries(item.fieldData)) {
                    if (entry.type === "image") {
                      const jobId = extractImageJobId(entry.value);
                      if (jobId) {
                        pendingImageTargets.push({ jobId, fieldId: key });
                        continue;
                      }
                    }
                    fieldValues[key] = entry.value;
                  }
                }
                try {
                  const id = await fetchProductMutation(
                    anyApi.stagedItems.create,
                    {
                      clerkOrganizationId: stagingContext.organizationId,
                      collectionId: payload.collectionId,
                      slug: item.slug,
                      draft: item.draft ?? true,
                      fieldDataJson: JSON.stringify(fieldValues),
                      createdByUserId: stagingContext.userId,
                      source: "ai" as const,
                    },
                  );
                  const stagedId = String(id);
                  stagedItems.push({
                    id: `staged:${stagedId}`,
                    stagedId,
                    slug: item.slug,
                    draft: item.draft ?? true,
                    fieldData: item.fieldData,
                  });

                  for (const target of pendingImageTargets) {
                    await attachImageJobToStagedItem(target.jobId, {
                      stagedItemId: stagedId,
                      fieldId: target.fieldId,
                    });
                  }
                } catch (err) {
                  logError("ai.cms_action.stage_item_failed", err, { slug: item.slug });
                }
              }
              const slugs = payload.items.map((item) => item.slug);
              logEvent("info", "ai.cms_action.staged", {
                action: payload.action,
                durationMs: Date.now() - startMs,
                slugs,
                stagedCount: stagedItems.length,
              });
              return {
                success: true,
                action: payload.action,
                staged: true,
                collectionId: payload.collectionId,
                items: stagedItems,
              };
            }

            // Fallback: push directly to Framer (legacy/non-product mode)
            const normalized = payload.items.map((item) => ({
              ...item,
              fieldData: item.fieldData ? normalizeFieldData(item.fieldData) : undefined,
            }));
            result = await (runInFramerContext
              ? runInFramerContext(() => addCollectionItems(payload.collectionId, normalized))
              : addCollectionItems(payload.collectionId, normalized));
            const slugs = payload.items.map((item) => item.slug);
            logEvent("info", "ai.cms_action.success", {
              action: payload.action,
              durationMs: Date.now() - startMs,
              slugs,
            });
            return {
              success: true,
              action: payload.action,
              items: payload.items.map((item) => ({
                slug: item.slug,
                draft: item.draft ?? false,
              })),
            };
          }
          case "set_item_attributes": {
            const attrs: Record<string, unknown> = {};
            if (payload.slug !== undefined) attrs.slug = payload.slug;
            if (payload.draft !== undefined) attrs.draft = payload.draft;
            if (payload.fieldData) attrs.fieldData = normalizeFieldData(payload.fieldData);
            result = await (runInFramerContext
              ? runInFramerContext(() =>
                  setCollectionItemAttributes(
                    payload.collectionId,
                    payload.itemId,
                    attrs as Parameters<typeof setCollectionItemAttributes>[2],
                  ))
              : setCollectionItemAttributes(
                  payload.collectionId,
                  payload.itemId,
                  attrs as Parameters<typeof setCollectionItemAttributes>[2],
                ));
            logEvent("info", "ai.cms_action.success", {
              action: payload.action,
              durationMs: Date.now() - startMs,
              itemId: payload.itemId,
            });
            return { success: true, action: payload.action, itemId: payload.itemId };
          }
          case "remove_items":
            result = await (runInFramerContext
              ? runInFramerContext(() => removeCollectionItems(payload.collectionId, payload.itemIds))
              : removeCollectionItems(payload.collectionId, payload.itemIds));
            break;
          case "remove_item":
            result = await (runInFramerContext
              ? runInFramerContext(() => removeCollectionItem(payload.collectionId, payload.itemId))
              : removeCollectionItem(payload.collectionId, payload.itemId));
            break;
          case "add_enum_case":
            result = await (runInFramerContext
              ? runInFramerContext(() => addEnumCase(payload.collectionId, payload.fieldId, payload.name))
              : addEnumCase(payload.collectionId, payload.fieldId, payload.name));
            break;
          case "update_enum_case":
            result = await (runInFramerContext
              ? runInFramerContext(() => updateEnumCase(payload.collectionId, payload.fieldId, payload.caseId, payload.newName))
              : updateEnumCase(payload.collectionId, payload.fieldId, payload.caseId, payload.newName));
            break;
          case "remove_enum_case":
            result = await (runInFramerContext
              ? runInFramerContext(() => removeEnumCase(payload.collectionId, payload.fieldId, payload.caseId))
              : removeEnumCase(payload.collectionId, payload.fieldId, payload.caseId));
            break;
          case "set_enum_case_order":
            result = await (runInFramerContext
              ? runInFramerContext(() => setEnumCaseOrder(payload.collectionId, payload.fieldId, payload.caseIds))
              : setEnumCaseOrder(payload.collectionId, payload.fieldId, payload.caseIds));
            break;
          case "publish":
            result = await (runInFramerContext
              ? runInFramerContext(() => publishSite())
              : publishSite());
            break;
        }

        // Invalidate snapshot cache for enum mutations
        if (
          payload.action === "add_enum_case" ||
          payload.action === "update_enum_case" ||
          payload.action === "remove_enum_case" ||
          payload.action === "set_enum_case_order"
        ) {
          invalidateAIContextSnapshot();
        }

        logEvent("info", "ai.cms_action.success", {
          action: payload.action,
          durationMs: Date.now() - startMs,
        });
        return { success: true, action: payload.action };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logError("ai.cms_action.failed", err, { action: payload.action });
        return { success: false, action: payload.action, error: message };
      }
    },
  });

  return {
    framer_add_collection_items: framerAddCollectionItems,
    framer_add_enum_case: framerAddEnumCase,
    framer_get_collection: framerGetCollection,
    framer_get_collection_fields: framerGetCollectionFields,
    framer_get_collection_items: framerGetCollectionItems,
    framer_get_collections: framerGetCollections,
    framer_get_enum_cases: framerGetEnumCases,
    framer_get_project_info: framerGetProjectInfo,
    framer_get_publish_info: framerGetPublishInfo,
    framer_publish: framerPublish,
    framer_remove_collection_items: framerRemoveCollectionItems,
    framer_remove_enum_case: framerRemoveEnumCase,
    framer_remove_item: framerRemoveItem,
    framer_set_collection_as_active: framerSetCollectionAsActive,
    framer_set_enum_case_order: framerSetEnumCaseOrder,
    framer_set_item_attributes: framerSetItemAttributes,
    framer_update_enum_case: framerUpdateEnumCase,
    propose_cms_action: proposeCmsAction,
  } as const;
}

export function createScopedFramerTools(
  runInFramerContext: RunInFramerContext,
  stagingContext?: { organizationId: string; userId: string },
) {
  return buildFramerTools(runInFramerContext, stagingContext);
}

export const framerTools = buildFramerTools();
