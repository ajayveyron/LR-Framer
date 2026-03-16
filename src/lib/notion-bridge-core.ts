import { createHash } from "node:crypto";

import type {
  BlogCollectionMetadata,
  BridgeRemovalInput,
  BridgeSyncInput,
  BridgeSyncResponse,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";
import { AppError } from "@/lib/errors";

export const LOGICAL_FIELD_PATTERNS = {
  title: ["title", "headline", "name", "post title"],
  body: ["body", "content", "post body", "article body", "copy", "markdown"],
  author: ["author", "writer", "byline"],
  date: ["date", "publish date", "published date", "published", "publication date"],
  slug: ["slug", "url slug", "permalink"],
} as const;

export interface NotionBridgeConfig {
  approvedStatusValue: string;
  fieldMap?: Record<string, string>;
  framerItemIdPropertyName: string;
  slugPropertyName: string;
  statusPropertyName: string;
}

export type NotionPropertyType =
  | "checkbox"
  | "created_time"
  | "date"
  | "email"
  | "files"
  | "formula"
  | "last_edited_time"
  | "multi_select"
  | "number"
  | "phone_number"
  | "rich_text"
  | "select"
  | "status"
  | "title"
  | "unique_id"
  | "url";

export type NotionRichText = {
  plain_text?: string;
  text?: {
    content?: string;
  };
};

export type NotionProperty = {
  id: string;
  type: NotionPropertyType | string;
  checkbox?: boolean;
  created_time?: string;
  date?: {
    start?: string | null;
  } | null;
  email?: string | null;
  files?: Array<{
    name?: string;
    type: "external" | "file";
    external?: {
      url?: string;
    };
    file?: {
      url?: string;
    };
  }>;
  formula?: {
    type?: string;
    string?: string | null;
    number?: number | null;
    boolean?: boolean | null;
    date?: {
      start?: string | null;
    } | null;
  } | null;
  last_edited_time?: string;
  multi_select?: Array<{ name?: string | null }>;
  number?: number | null;
  phone_number?: string | null;
  rich_text?: NotionRichText[];
  select?: {
    name?: string | null;
  } | null;
  status?: {
    name?: string | null;
  } | null;
  title?: NotionRichText[];
  unique_id?: {
    number?: number | null;
    prefix?: string | null;
  } | null;
  url?: string | null;
};

export type NotionPage = {
  object: "page";
  id: string;
  archived?: boolean;
  in_trash?: boolean;
  last_edited_time?: string;
  url?: string;
  properties: Record<string, NotionProperty>;
};

export function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTextValue(chunks: NotionRichText[] | undefined) {
  return (chunks ?? [])
    .map((chunk) => chunk.plain_text ?? chunk.text?.content ?? "")
    .join("")
    .trim();
}

function extractFileUrl(property: NotionProperty) {
  const firstFile = property.files?.[0];
  if (!firstFile) {
    return null;
  }

  return firstFile.type === "external"
    ? firstFile.external?.url ?? null
    : firstFile.file?.url ?? null;
}

function extractStableFileValue(property: NotionProperty) {
  const firstFile = property.files?.[0];
  if (!firstFile) {
    return null;
  }

  return firstFile.type === "external"
    ? firstFile.external?.url ?? null
    : firstFile.name ?? firstFile.file?.url ?? null;
}

function extractFormulaValue(property: NotionProperty) {
  const formula = property.formula;
  if (!formula) {
    return null;
  }

  switch (formula.type) {
    case "string":
      return formula.string ?? null;
    case "number":
      return formula.number ?? null;
    case "boolean":
      return formula.boolean ?? null;
    case "date":
      return formula.date?.start ?? null;
    default:
      return null;
  }
}

export function extractPropertyValue(property: NotionProperty): DashboardFieldValue {
  switch (property.type) {
    case "title":
      return extractTextValue(property.title);
    case "rich_text":
      return extractTextValue(property.rich_text);
    case "status":
      return property.status?.name ?? null;
    case "select":
      return property.select?.name ?? null;
    case "multi_select":
      return (property.multi_select ?? [])
        .map((option) => option.name ?? "")
        .filter((option) => option.length > 0);
    case "number":
      return property.number ?? null;
    case "checkbox":
      return Boolean(property.checkbox);
    case "date":
      return property.date?.start ?? null;
    case "url":
      return property.url ?? null;
    case "email":
      return property.email ?? null;
    case "phone_number":
      return property.phone_number ?? null;
    case "files":
      return extractFileUrl(property);
    case "formula":
      return extractFormulaValue(property);
    case "created_time":
      return property.created_time ?? null;
    case "last_edited_time":
      return property.last_edited_time ?? null;
    case "unique_id": {
      const prefix = property.unique_id?.prefix ?? "";
      const number = property.unique_id?.number;
      return number === null || number === undefined ? null : `${prefix}${number}`;
    }
    default:
      return null;
  }
}

export function extractStablePropertyValue(property: NotionProperty): DashboardFieldValue {
  if (property.type === "files") {
    return extractStableFileValue(property);
  }

  return extractPropertyValue(property);
}

export function buildSourceVersion(
  page: NotionPage,
  markdownBody: string,
  config: Pick<NotionBridgeConfig, "framerItemIdPropertyName">,
) {
  const ignoredPropertyNames = new Set([normalizeLabel(config.framerItemIdPropertyName)]);
  const properties = Object.entries(page.properties)
    .filter(([propertyName]) => !ignoredPropertyNames.has(normalizeLabel(propertyName)))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([propertyName, property]) => [
      propertyName,
      extractStablePropertyValue(property),
    ]);

  return createHash("sha256")
    .update(
      JSON.stringify({
        properties,
        markdownBody: markdownBody.trim(),
      }),
    )
    .digest("hex");
}

export function getPropertyByName<T extends { type: string }>(
  properties: Record<string, T>,
  name: string,
) {
  const normalizedName = normalizeLabel(name);
  return Object.entries(properties).find(
    ([propertyName]) => normalizeLabel(propertyName) === normalizedName,
  );
}

export function getPropertyByPatterns<T extends { type: string }>(
  properties: Record<string, T>,
  patterns: readonly string[],
) {
  return Object.entries(properties).find(([propertyName]) =>
    patterns.includes(normalizeLabel(propertyName)),
  );
}

function getMappedPropertyEntry(
  properties: Record<string, NotionProperty>,
  field: DashboardFieldDefinition,
  logicalKey: keyof typeof LOGICAL_FIELD_PATTERNS | undefined,
  fieldMap: Record<string, string>,
) {
  const configuredName =
    fieldMap[field.id] ??
    fieldMap[field.name] ??
    (logicalKey ? fieldMap[logicalKey] : undefined);

  if (configuredName) {
    return getPropertyByName(properties, configuredName);
  }

  if (logicalKey) {
    const logicalMatch = getPropertyByPatterns(
      properties,
      LOGICAL_FIELD_PATTERNS[logicalKey],
    );
    if (logicalMatch) {
      return logicalMatch;
    }
  }

  return getPropertyByName(properties, field.name);
}

function coerceValueForField(
  field: DashboardFieldDefinition,
  value: DashboardFieldValue,
) {
  if (value === null || value === undefined) {
    if (field.type === "boolean") {
      return false;
    }

    if (field.type === "multiCollectionReference") {
      return [];
    }

    return null;
  }

  switch (field.type) {
    case "string":
    case "formattedText":
    case "link":
    case "image":
    case "file":
    case "color":
    case "collectionReference":
      if (Array.isArray(value)) {
        return value.length > 0 ? String(value[0]) : "";
      }
      return String(value);
    case "number":
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    case "boolean":
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        return value.toLowerCase() === "true";
      }
      return Boolean(value);
    case "date":
      if (typeof value !== "string" || value.length === 0) {
        return null;
      }
      return field.displayTime ? value : value.slice(0, 10);
    case "enum":
      return Array.isArray(value)
        ? value.length > 0
          ? String(value[0])
          : ""
        : String(value);
    case "multiCollectionReference":
      return Array.isArray(value)
        ? value.map((entry) => String(entry))
        : value
          ? [String(value)]
          : [];
    default:
      return value;
  }
}

export function getTitleValue(properties: Record<string, NotionProperty>) {
  const titleEntry =
    Object.entries(properties).find(([, property]) => property.type === "title") ??
    getPropertyByPatterns(properties, LOGICAL_FIELD_PATTERNS.title);

  if (!titleEntry) {
    throw new AppError("The Notion page does not expose a title property.", 400);
  }

  const title = extractPropertyValue(titleEntry[1]);
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new AppError("The Notion page title is empty.", 400);
  }

  return title.trim();
}

export function getStatusValue(
  properties: Record<string, NotionProperty>,
  config: Pick<NotionBridgeConfig, "statusPropertyName">,
) {
  const statusProperty = properties[config.statusPropertyName];
  return statusProperty ? extractPropertyValue(statusProperty) : null;
}

export function isActivePage(page: NotionPage) {
  return !page.archived && !page.in_trash;
}

export function isApprovedPage(page: NotionPage, config: NotionBridgeConfig) {
  const statusValue = getStatusValue(page.properties, config);

  if (typeof statusValue === "boolean") {
    return statusValue === (config.approvedStatusValue.toLowerCase() === "true");
  }

  return normalizeLabel(String(statusValue ?? "")) ===
    normalizeLabel(config.approvedStatusValue);
}

function getFallbackFieldValue(
  field: DashboardFieldDefinition,
  value: DashboardFieldValue,
  title: string,
) {
  const isDescriptionField = normalizeLabel(field.name) === "description";
  const isEmptyString = typeof value === "string" && value.trim().length === 0;

  if (isDescriptionField && (value === null || value === undefined || isEmptyString)) {
    return title;
  }

  return value;
}

function buildFieldValues(
  metadata: BlogCollectionMetadata,
  properties: Record<string, NotionProperty>,
  markdownBody: string,
  config: NotionBridgeConfig,
) {
  const fieldValues: Record<string, DashboardFieldValue> = {};
  const title = getTitleValue(properties);
  const fieldMap = config.fieldMap ?? {};

  for (const field of metadata.fields) {
    if (!field.supported) {
      continue;
    }

    if (field.logicalKey === "body" && markdownBody.length > 0) {
      fieldValues[field.id] = markdownBody;
      continue;
    }

    const propertyEntry = getMappedPropertyEntry(
      properties,
      field,
      field.logicalKey as keyof typeof LOGICAL_FIELD_PATTERNS | undefined,
      fieldMap,
    );
    if (!propertyEntry) {
      const fallbackValue = getFallbackFieldValue(field, null, title);
      if (fallbackValue !== null) {
        fieldValues[field.id] = coerceValueForField(field, fallbackValue);
      }
      continue;
    }

    const extractedValue = getFallbackFieldValue(
      field,
      extractPropertyValue(propertyEntry[1]),
      title,
    );
    if (field.type === "boolean" && extractedValue === null) {
      continue;
    }

    fieldValues[field.id] = coerceValueForField(field, extractedValue);
  }

  return fieldValues;
}

function getOptionalTitleValue(properties: Record<string, NotionProperty>) {
  try {
    return getTitleValue(properties);
  } catch {
    return null;
  }
}

export function getBridgePageIdentifiers(
  page: NotionPage,
  config: Pick<NotionBridgeConfig, "fieldMap" | "framerItemIdPropertyName" | "slugPropertyName">,
  fallbackTitle = getOptionalTitleValue(page.properties),
): {
  framerItemId: string | null;
  slug: string | null;
} {
  const fieldMap = config.fieldMap ?? {};
  const slugProperty =
    getPropertyByName(page.properties, config.slugPropertyName) ??
    getPropertyByPatterns(page.properties, LOGICAL_FIELD_PATTERNS.slug) ??
    (fieldMap.slug ? getPropertyByName(page.properties, fieldMap.slug) : undefined);
  const framerItemIdProperty = getPropertyByName(
    page.properties,
    config.framerItemIdPropertyName,
  );
  const slugValue = slugProperty ? extractPropertyValue(slugProperty[1]) : null;
  const framerItemIdValue = framerItemIdProperty
    ? extractPropertyValue(framerItemIdProperty[1])
    : null;
  const slug =
    typeof slugValue === "string" && slugValue.trim().length > 0
      ? slugify(slugValue)
      : fallbackTitle
        ? slugify(fallbackTitle)
        : null;

  return {
    framerItemId:
      typeof framerItemIdValue === "string" && framerItemIdValue.trim().length > 0
        ? framerItemIdValue.trim()
        : null,
    slug,
  };
}

export function buildBridgeSyncInput(
  metadata: BlogCollectionMetadata,
  page: NotionPage,
  markdownBody: string,
  config: NotionBridgeConfig,
  options?: {
    draft?: boolean;
  },
): BridgeSyncInput {
  const title = getTitleValue(page.properties);
  const { framerItemId, slug } = getBridgePageIdentifiers(page, config, title);
  if (!slug) {
    throw new AppError(
      `The Notion page "${title}" could not produce a valid slug.`,
      400,
    );
  }

  return {
    externalId: page.id,
    framerItemId,
    sourceVersion: buildSourceVersion(page, markdownBody, config),
    slug,
    draft: options?.draft ?? false,
    fieldValues: buildFieldValues(metadata, page.properties, markdownBody, config),
  };
}

export function buildBridgeRemovalInput(
  page: NotionPage,
  config: Pick<NotionBridgeConfig, "fieldMap" | "framerItemIdPropertyName" | "slugPropertyName">,
): BridgeRemovalInput {
  const { framerItemId, slug } = getBridgePageIdentifiers(page, config);

  return {
    externalId: page.id,
    framerItemId,
    slug,
  };
}

export interface SyncNotionPageDeps {
  backfillFramerItemId?: (page: NotionPage, framerItemId: string) => Promise<boolean>;
  removeBridgePosts: (
    inputs: BridgeRemovalInput[],
    actor: string,
  ) => Promise<BridgeSyncResponse>;
  syncBridgePosts: (
    inputs: BridgeSyncInput[],
    actor: string,
    publishRequested?: boolean,
  ) => Promise<BridgeSyncResponse>;
}

export async function syncNotionPageToFramer(
  metadata: BlogCollectionMetadata,
  page: NotionPage,
  markdownBody: string,
  config: NotionBridgeConfig,
  deps: SyncNotionPageDeps,
  actor = "notion-bridge",
) {
  if (!isActivePage(page)) {
    const cleanupResult = await deps.removeBridgePosts(
      [buildBridgeRemovalInput(page, config)],
      actor,
    );

    return {
      mode: "page" as const,
      syncedPages: 0,
      removedPages: cleanupResult.results.length,
      skippedPages:
        cleanupResult.results.length > 0
          ? []
          : [
              {
                pageId: page.id,
                reason: "The page is archived or trashed.",
              },
            ],
      backfilledFramerItemIds: 0,
      results: cleanupResult.results,
      publish: cleanupResult.publish,
    };
  }

  const syncResult = await deps.syncBridgePosts(
    [
      buildBridgeSyncInput(metadata, page, markdownBody, config, {
        draft: !isApprovedPage(page, config),
      }),
    ],
    actor,
    true,
  );
  let backfilledFramerItemIds = 0;

  for (const result of syncResult.results) {
    if (!deps.backfillFramerItemId) {
      continue;
    }

    if (await deps.backfillFramerItemId(page, result.framerItemId)) {
      backfilledFramerItemIds += 1;
    }
  }

  return {
    mode: "page" as const,
    syncedPages: syncResult.results.length,
    removedPages: 0,
    skippedPages: [],
    backfilledFramerItemIds,
    results: syncResult.results,
    publish: syncResult.publish,
  };
}
