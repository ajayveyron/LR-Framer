import { tool } from "ai";
import { z } from "zod";

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

function wrapExecute<T>(
  event: string,
  fn: () => Promise<T>,
  meta: Record<string, unknown> = {},
): Promise<T> {
  logEvent("info", `ai.tool.${event}.called`, meta);
  return fn().catch((error) => {
    logError(`ai.tool.${event}.failed`, error, meta);
    throw error;
  });
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const framerGetProjectInfo = tool({
  description: "Get the Framer project name and hashed project ID.",
  inputSchema: z.object({}),
  execute: () => wrapExecute("getProjectInfo", getProjectInfo),
});

export const framerGetPublishInfo = tool({
  description:
    "Get publish/deployment info for both staging and production environments. Returns deployment time, URL, and optimization status for each.",
  inputSchema: z.object({}),
  execute: () => wrapExecute("getPublishInfo", getPublishInfo),
});

export const framerPublish = tool({
  description:
    "Publish the Framer site. Creates a new deployment and returns the deployment ID, creation time, and hostnames.",
  inputSchema: z.object({}),
  execute: () => wrapExecute("publish", publishSite),
});

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export const framerGetCollections = tool({
  description:
    "List all CMS collections in the Framer project. Returns each collection's ID, name, managedBy status, readonly flag, and slug field info.",
  inputSchema: z.object({}),
  execute: () => wrapExecute("getCollections", getAllCollections),
});

export const framerGetCollection = tool({
  description:
    "Get a specific CMS collection by its ID. Returns the collection's metadata including name, managedBy, readonly, and slug field info.",
  inputSchema: z.object({
    collectionId: z.string().describe("The ID of the collection to retrieve"),
  }),
  execute: ({ collectionId }) =>
    wrapExecute("getCollection", () => getCollectionById(collectionId), {
      collectionId,
    }),
});

// ---------------------------------------------------------------------------
// Collection Fields
// ---------------------------------------------------------------------------

export const framerGetCollectionFields = tool({
  description:
    "Get all fields defined on a CMS collection. Returns each field's ID, name, type, required status, and for enum fields their cases.",
  inputSchema: z.object({
    collectionId: z.string().describe("The ID of the collection"),
  }),
  execute: ({ collectionId }) =>
    wrapExecute("getCollectionFields", () => getCollectionFields(collectionId), {
      collectionId,
    }),
});

// ---------------------------------------------------------------------------
// Collection Items
// ---------------------------------------------------------------------------

export const framerGetCollectionItems = tool({
  description:
    "Get all items (rows) in a CMS collection. Returns each item's ID, slug, draft status, and field data.",
  inputSchema: z.object({
    collectionId: z.string().describe("The ID of the collection"),
  }),
  execute: ({ collectionId }) =>
    wrapExecute("getCollectionItems", () => getCollectionItems(collectionId), {
      collectionId,
    }),
});

export const framerAddCollectionItems = tool({
  description:
    "Add new items to a CMS collection, or update existing ones if an ID is provided. Each item needs a slug and optionally fieldData with typed entries like { type: 'string', value: 'hello' }.",
  inputSchema: z.object({
    collectionId: z.string().describe("The ID of the collection"),
    items: z
      .array(
        z.object({
          id: z.string().optional().describe("Existing item ID to update (omit for new items)"),
          slug: z.string().describe("Unique slug for the item"),
          draft: z.boolean().optional().describe("Whether the item is a draft"),
          fieldData: z
            .record(
              z.string(),
              z.object({
                type: z.string().describe("Field type (string, number, boolean, formattedText, date, enum, image, file, link, color, collectionReference, multiCollectionReference)"),
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
    ),
});

export const framerRemoveCollectionItems = tool({
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
    ),
});

export const framerSetItemAttributes = tool({
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
    ),
});

export const framerRemoveItem = tool({
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
    ),
});

// ---------------------------------------------------------------------------
// Enum Fields
// ---------------------------------------------------------------------------

export const framerGetEnumCases = tool({
  description: "Get all cases (options) for an enum field in a collection.",
  inputSchema: z.object({
    collectionId: z.string().describe("The ID of the collection"),
    fieldId: z.string().describe("The ID of the enum field"),
  }),
  execute: ({ collectionId, fieldId }) =>
    wrapExecute("getEnumCases", () => getEnumFieldCases(collectionId, fieldId), {
      collectionId,
      fieldId,
    }),
});

export const framerAddEnumCase = tool({
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
    ),
});

export const framerSetEnumCaseOrder = tool({
  description: "Reorder the cases of an enum field by providing case IDs in the desired order.",
  inputSchema: z.object({
    collectionId: z.string().describe("The ID of the collection"),
    fieldId: z.string().describe("The ID of the enum field"),
    caseIds: z.array(z.string()).describe("Array of case IDs in the desired order"),
  }),
  execute: ({ collectionId, fieldId, caseIds }) =>
    wrapExecute(
      "setEnumCaseOrder",
      () => setEnumCaseOrder(collectionId, fieldId, caseIds),
      { collectionId, fieldId },
    ),
});

export const framerUpdateEnumCase = tool({
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
    ),
});

export const framerRemoveEnumCase = tool({
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
    ),
});

// ---------------------------------------------------------------------------
// Collection Metadata
// ---------------------------------------------------------------------------

export const framerSetCollectionAsActive = tool({
  description: "Set a collection as the active/selected collection in the Framer UI.",
  inputSchema: z.object({
    collectionId: z.string().describe("The ID of the collection to activate"),
  }),
  execute: ({ collectionId }) =>
    wrapExecute(
      "setCollectionAsActive",
      () => setCollectionAsActive(collectionId),
      { collectionId },
    ),
});

// ---------------------------------------------------------------------------
// All tools map (for easy import into chat route)
// ---------------------------------------------------------------------------

export const framerTools = {
  framer_get_project_info: framerGetProjectInfo,
  framer_get_publish_info: framerGetPublishInfo,
  framer_publish: framerPublish,
  framer_get_collections: framerGetCollections,
  framer_get_collection: framerGetCollection,
  framer_get_collection_fields: framerGetCollectionFields,
  framer_get_collection_items: framerGetCollectionItems,
  framer_add_collection_items: framerAddCollectionItems,
  framer_remove_collection_items: framerRemoveCollectionItems,
  framer_set_item_attributes: framerSetItemAttributes,
  framer_remove_item: framerRemoveItem,
  framer_get_enum_cases: framerGetEnumCases,
  framer_add_enum_case: framerAddEnumCase,
  framer_set_enum_case_order: framerSetEnumCaseOrder,
  framer_update_enum_case: framerUpdateEnumCase,
  framer_remove_enum_case: framerRemoveEnumCase,
  framer_set_collection_as_active: framerSetCollectionAsActive,
} as const;
