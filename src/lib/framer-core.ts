// ---------------------------------------------------------------------------
// Polyfill FileReader for Node.js — the Framer SDK uses it internally during
// asset uploads, but it's a browser-only API.
// ---------------------------------------------------------------------------
if (typeof globalThis.FileReader === "undefined") {
  class _FileReader extends EventTarget {
    static readonly EMPTY = 0;
    static readonly LOADING = 1;
    static readonly DONE = 2;

    readonly EMPTY = 0;
    readonly LOADING = 1;
    readonly DONE = 2;

    readyState = 0;
    result: string | ArrayBuffer | null = null;
    error: DOMException | null = null;

    onload: ((ev: Event) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    onloadend: ((ev: Event) => void) | null = null;
    onloadstart: ((ev: Event) => void) | null = null;
    onprogress: ((ev: Event) => void) | null = null;
    onabort: ((ev: Event) => void) | null = null;

    private _finish(result: string | ArrayBuffer | null, error?: unknown) {
      if (error) {
        this.error = error instanceof DOMException ? error : new DOMException(String(error));
        this.readyState = 2;
        const ev = new Event("error");
        this.dispatchEvent(ev);
        this.onerror?.(ev);
      } else {
        this.result = result;
        this.readyState = 2;
        const ev = new Event("load");
        this.dispatchEvent(ev);
        this.onload?.(ev);
      }
      const endEv = new Event("loadend");
      this.dispatchEvent(endEv);
      this.onloadend?.(endEv);
    }

    readAsDataURL(blob: Blob) {
      this.readyState = 1;
      blob
        .arrayBuffer()
        .then((buf) => {
          const b64 = Buffer.from(buf).toString("base64");
          const mime = blob.type || "application/octet-stream";
          this._finish(`data:${mime};base64,${b64}`);
        })
        .catch((err) => this._finish(null, err));
    }

    readAsArrayBuffer(blob: Blob) {
      this.readyState = 1;
      blob
        .arrayBuffer()
        .then((buf) => this._finish(buf))
        .catch((err) => this._finish(null, err));
    }

    readAsText(blob: Blob) {
      this.readyState = 1;
      blob
        .text()
        .then((txt) => this._finish(txt))
        .catch((err) => this._finish(null, err));
    }

    abort() {
      this.readyState = 2;
      this.result = null;
      const ev = new Event("abort");
      this.dispatchEvent(ev);
      this.onabort?.(ev);
    }
  }

  (globalThis as any).FileReader = _FileReader;
}

import type {
  Collection,
  CollectionItem,
  Field,
  FieldDataInput,
  Framer,
  PublishResult,
} from "framer-api";
import { isRetryableError, withConnection } from "framer-api";

import type {
  BlogCollectionMetadata,
  BridgeRemovalInput,
  BridgeSyncInput,
  BridgeSyncResponse,
  BridgeSyncResult,
  BlogPostRecord,
  BlogPostSummary,
  DashboardFieldDefinition,
  DashboardFieldType,
  DashboardFieldValue,
  LogicalFieldKey,
  PublishResponse,
  ReferenceOption,
  UpsertBlogPostInput,
} from "./cms-types.ts";
import { AppError } from "./errors.ts";
import { getFramerRuntimeContext } from "./framer-runtime.ts";
import { logError, logEvent } from "./logger.ts";
import { looksLikeHtml } from "./shared-utils.ts";

const LAST_EDITED_AT_KEY = "lr:lastEditedAt";
const LAST_EDITED_BY_KEY = "lr:lastEditedBy";
const CREATED_AT_KEY = "lr:createdAt";
const SOURCE_VERSION_KEY = "lr:sourceVersion";
const BRIDGE_EXTERNAL_ID_KEY = "lr:bridgeExternalId";

const LOGICAL_FIELD_PATTERNS: Record<LogicalFieldKey, string[]> = {
  title: ["title", "headline", "name", "post title"],
  body: ["body", "content", "post body", "article body", "copy", "markdown"],
  author: ["author", "writer", "byline"],
  date: ["date", "publish date", "published date", "published", "publication date"],
};

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getFieldType(field: Field): DashboardFieldType {
  return field.type as DashboardFieldType;
}

function isFieldRequired(field: Field) {
  return "required" in field && typeof field.required === "boolean"
    ? field.required
    : false;
}

function extractFieldValue(entry: CollectionItem["fieldData"][string]) {
  if (!entry) {
    return null;
  }

  if (entry.type === "image") {
    const img = entry.value as { url?: string; altText?: string } | null;
    if (!img?.url) return null;
    return img.altText ? { url: img.url, alt: img.altText } : img.url;
  }

  if (entry.type === "file") {
    return entry.value?.url ?? null;
  }

  if (entry.type === "color") {
    return typeof entry.value === "string" ? entry.value : null;
  }

  if (entry.type === "multiCollectionReference") {
    return [...entry.value];
  }

  if (entry.type === "array") {
    return entry.value.map((item) => ({
      id: item.id,
      fieldData: Object.fromEntries(
        Object.entries(item.fieldData).map(([fieldId, arrayEntry]) => [
          fieldId,
          arrayEntry.type === "image" ? arrayEntry.value?.url ?? null : null,
        ]),
      ),
    }));
  }

  return (entry.value ?? null) as DashboardFieldValue;
}

function formatDisplayValue(value: DashboardFieldValue) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  if (value === null || value === "") {
    return "";
  }

  // Image field value with alt text metadata — display the URL
  if (typeof value === "object" && "url" in value) {
    return String(value.url);
  }

  return String(value);
}

function getFormattedTextContentType(value: string) {
  return looksLikeHtml(value) ? "html" : "markdown";
}

function findLogicalField(
  fields: Field[],
  key: LogicalFieldKey,
): Field | undefined {
  const patterns = LOGICAL_FIELD_PATTERNS[key];
  return fields.find((field) => patterns.includes(normalizeLabel(field.name)));
}

function fallbackLogicalField(
  fields: Field[],
  key: LogicalFieldKey,
): Field | undefined {
  switch (key) {
    case "title":
      return fields.find((field) =>
        ["string", "formattedText"].includes(field.type),
      );
    case "body":
      return fields.find((field) => field.type === "formattedText");
    case "author":
      return fields.find((field) =>
        normalizeLabel(field.name).includes("author"),
      );
    case "date":
      return fields.find((field) => field.type === "date");
  }
}

function getLogicalFieldMap(fields: Field[]) {
  return {
    title: (findLogicalField(fields, "title") ?? fallbackLogicalField(fields, "title"))?.id,
    body: (findLogicalField(fields, "body") ?? fallbackLogicalField(fields, "body"))?.id,
    author: (findLogicalField(fields, "author") ?? fallbackLogicalField(fields, "author"))?.id,
    date: (findLogicalField(fields, "date") ?? fallbackLogicalField(fields, "date"))?.id,
  } satisfies Partial<Record<LogicalFieldKey, string>>;
}

function indexCollectionItems(items: CollectionItem[]) {
  return {
    byId: new Map(items.map((item) => [item.id, item] as const)),
    bySlug: new Map(items.map((item) => [normalizeLabel(item.slug), item] as const)),
  };
}

const FRAMER_MAX_RETRIES = 2;
const FRAMER_RETRY_BASE_MS = 500;

function isTransientConnectionError(error: unknown): boolean {
  if (isRetryableError(error)) return true;

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("no connection") ||
    message.includes("session expired") ||
    message.includes("project_closed")
  );
}

async function withFramerProject<T>(callback: (framer: Framer) => Promise<T>) {
  const runtimeContext = getFramerRuntimeContext();
  let lastError: unknown;

  for (let attempt = 0; attempt <= FRAMER_MAX_RETRIES; attempt++) {
    try {
      return await withConnection(
        runtimeContext.projectId,
        async (framer) => callback(framer),
        runtimeContext.apiKey,
      );
    } catch (error) {
      lastError = error;

      if (attempt < FRAMER_MAX_RETRIES && isTransientConnectionError(error)) {
        const delayMs = FRAMER_RETRY_BASE_MS * 2 ** attempt;
        logEvent("warn", "framer.connection.retry", {
          attempt: attempt + 1,
          maxRetries: FRAMER_MAX_RETRIES,
          delayMs,
          errorMessage: error instanceof Error ? error.message : String(error),
          projectId: runtimeContext.projectId,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw error;
    }
  }

  // Unreachable in practice, but satisfies TypeScript
  throw lastError;
}

async function getBlogCollection(framer: Framer) {
  const runtimeContext = getFramerRuntimeContext();
  if (!runtimeContext.collectionId && !runtimeContext.collectionName) {
    throw new AppError(
      "A Framer collection must be selected before loading CMS data.",
      400,
    );
  }

  const collection = runtimeContext.collectionId
    ? await framer.getCollection(runtimeContext.collectionId)
    : (await framer.getCollections()).find(
        (entry) =>
          normalizeLabel(entry.name) ===
          normalizeLabel(runtimeContext.collectionName ?? ""),
      );

  if (!collection) {
    throw new AppError(
      `Collection "${runtimeContext.collectionName ?? runtimeContext.collectionId}" was not found in the Framer project.`,
      404,
    );
  }

  if (collection.managedBy !== "user") {
    throw new AppError(
      `Collection "${collection.name}" is not a user-managed CMS collection.`,
      400,
    );
  }

  return collection;
}

async function getReferenceCollectionData(
  framer: Framer,
  collectionId: string,
): Promise<{
  collectionId: string;
  collectionName: string;
  options: ReferenceOption[];
} | undefined> {
  const referenceCollection = await framer.getCollection(collectionId);
  if (!referenceCollection) {
    return undefined;
  }

  const [referenceFields, referenceItems] = await Promise.all([
    referenceCollection.getFields(),
    referenceCollection.getItems(),
  ]);
  const logicalFields = getLogicalFieldMap(referenceFields);
  const labelFieldId =
    logicalFields.title ??
    referenceFields.find((entry) =>
      ["string", "formattedText"].includes(entry.type),
    )?.id;

  return {
    collectionId: referenceCollection.id,
    collectionName: referenceCollection.name,
    options: referenceItems
      .map((item) => ({
        id: item.id,
        label: labelFieldId
          ? formatDisplayValue(extractFieldValue(item.fieldData[labelFieldId])) ||
            item.slug
          : item.slug,
        slug: item.slug,
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

async function getReferenceOptions(
  framer: Framer,
  field: Field,
  cache: Map<
    string,
    Promise<{
      collectionId: string;
      collectionName: string;
      options: ReferenceOption[];
    } | undefined>
  >,
) {
  if (
    field.type !== "collectionReference" &&
    field.type !== "multiCollectionReference"
  ) {
    return undefined;
  }

  const cacheKey = field.collectionId;
  let cached = cache.get(cacheKey);
  if (!cached) {
    cached = getReferenceCollectionData(framer, field.collectionId);
    cache.set(cacheKey, cached);
  }

  const referenceCollection = await cached;
  if (!referenceCollection) {
    return undefined;
  }

  return {
    ...referenceCollection,
    multiple: field.type === "multiCollectionReference",
  };
}

async function buildMetadata(
  framer: Framer,
  collection: Collection,
  fields: Field[],
): Promise<BlogCollectionMetadata> {
  const logicalFields = getLogicalFieldMap(fields);
  const schemaFields = fields.filter((field) => field.type !== "divider");
  const referenceCollectionCache = new Map<
    string,
    Promise<{
      collectionId: string;
      collectionName: string;
      options: ReferenceOption[];
    } | undefined>
  >();
  const referenceData = await Promise.all(
    schemaFields.map((field) =>
      getReferenceOptions(framer, field, referenceCollectionCache)),
  );

  const mappedFields: DashboardFieldDefinition[] = schemaFields.map(
    (field, index) => {
      const type = getFieldType(field);
      const supported =
        type !== "divider" && type !== "unsupported" && type !== "array";

      return {
        id: field.id,
        name: field.name,
        type,
        required: isFieldRequired(field),
        supported,
        logicalKey: (Object.entries(logicalFields).find(
          ([, fieldId]) => fieldId === field.id,
        )?.[0] ?? undefined) as LogicalFieldKey | undefined,
        options:
          field.type === "enum"
            ? field.cases.map((entry) => ({
                id: entry.id,
                label: entry.name,
                value: entry.name,
              }))
            : undefined,
        referenceCollection: referenceData[index],
        displayTime:
          field.type === "date" && "displayTime" in field
            ? field.displayTime
            : undefined,
        helpText:
          field.type === "formattedText"
            ? "Rich text is supported in the editor."
            : field.type === "array"
              ? "Gallery fields are read-only in this dashboard."
              : field.type === "unsupported"
                ? "Framer does not currently support editing this field type via the API."
                : undefined,
      };
    },
  );

  return {
    collectionId: collection.id,
    collectionName: collection.name,
    logicalFields,
    fields: mappedFields,
  };
}

async function getMetadataWithFields(
  framer: Framer,
  collection: Collection,
) {
  const fields = await collection.getFields();
  return {
    fields,
    metadata: await buildMetadata(framer, collection, fields),
  };
}

async function getItemAuditData(item: CollectionItem) {
  const [createdAt, lastUpdated, lastUpdatedBy] = await Promise.all([
    item.getPluginData(CREATED_AT_KEY),
    item.getPluginData(LAST_EDITED_AT_KEY),
    item.getPluginData(LAST_EDITED_BY_KEY),
  ]);

  return {
    createdAt: createdAt ?? null,
    lastUpdated: lastUpdated ?? null,
    lastUpdatedBy: lastUpdatedBy ?? null,
  };
}

async function serializePost(
  item: CollectionItem,
  metadata: BlogCollectionMetadata,
): Promise<BlogPostRecord> {
  const fieldValues = Object.fromEntries(
    metadata.fields
      .filter((field) => field.type !== "divider")
      .map((field) => [field.id, extractFieldValue(item.fieldData[field.id])]),
  );

  const titleFieldId = metadata.logicalFields.title;
  const dateFieldId = metadata.logicalFields.date;
  const auditData = await getItemAuditData(item);
  const titleValue = titleFieldId
    ? extractFieldValue(item.fieldData[titleFieldId])
    : null;
  const dateValue = dateFieldId
    ? extractFieldValue(item.fieldData[dateFieldId])
    : null;

  return {
    id: item.id,
    slug: item.slug,
    draft: item.draft,
    title: titleFieldId ? formatDisplayValue(titleValue) || item.slug : item.slug,
    date: typeof dateValue === "string" ? dateValue : null,
    createdAt: auditData.createdAt,
    lastUpdated: auditData.lastUpdated,
    lastUpdatedBy: auditData.lastUpdatedBy,
    fieldValues,
  };
}

function serializeSummary(record: BlogPostRecord): BlogPostSummary {
  return {
    id: record.id,
    slug: record.slug,
    draft: record.draft,
    title: record.title,
    date: record.date,
    createdAt: record.createdAt,
    lastUpdated: record.lastUpdated,
    lastUpdatedBy: record.lastUpdatedBy,
  };
}

function normalizeDateInput(value: DashboardFieldValue, withTime?: boolean) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (!withTime) {
    return value;
  }

  if (value.endsWith("Z")) {
    return value;
  }

  return new Date(value).toISOString();
}

function buildFieldDataInput(
  metadata: BlogCollectionMetadata,
  input: UpsertBlogPostInput,
  previous?: BlogPostRecord,
) {
  const payload: FieldDataInput = {};

  for (const field of metadata.fields) {
    if (!field.supported) {
      continue;
    }

    const nextValue = input.fieldValues[field.id];
    const previousValue = previous?.fieldValues[field.id];
    const shouldPreserveExisting =
      nextValue === "" &&
      previousValue !== undefined &&
      ["number", "enum"].includes(field.type);

    if (shouldPreserveExisting) {
      continue;
    }

    if (field.required) {
      const isMissing =
        nextValue === undefined ||
        nextValue === null ||
        nextValue === "" ||
        (Array.isArray(nextValue) && nextValue.length === 0);
      if (isMissing) {
        throw new AppError(`"${field.name}" is required.`, 400);
      }
    }

    switch (field.type) {
      case "string":
        if (nextValue === undefined) break;
        payload[field.id] = {
          type: "string",
          value: typeof nextValue === "string" ? nextValue : "",
        };
        break;
      case "formattedText":
        if (nextValue === undefined) break;
        payload[field.id] = {
          type: "formattedText",
          value: typeof nextValue === "string" ? nextValue : "",
          contentType:
            typeof nextValue === "string"
              ? getFormattedTextContentType(nextValue)
              : "markdown",
        };
        break;
      case "number":
        if (nextValue === undefined || nextValue === "") break;
        payload[field.id] = {
          type: "number",
          value:
            typeof nextValue === "number" ? nextValue : Number(String(nextValue)),
        };
        break;
      case "boolean":
        if (nextValue === undefined) break;
        payload[field.id] = {
          type: "boolean",
          value: typeof nextValue === "boolean" ? nextValue : Boolean(nextValue),
        };
        break;
      case "date":
        payload[field.id] = {
          type: "date",
          value: normalizeDateInput(nextValue, field.displayTime),
        };
        break;
      case "enum":
        if (nextValue === undefined || nextValue === "") break;
        payload[field.id] = {
          type: "enum",
          value: resolveEnumCaseValue(field, nextValue),
        };
        break;
      case "link":
        payload[field.id] = {
          type: "link",
          value: nextValue ? String(nextValue) : null,
        };
        break;
      case "image":
        payload[field.id] = {
          type: "image",
          value: nextValue ? String(nextValue) : null,
        };
        break;
      case "file":
        payload[field.id] = {
          type: "file",
          value: nextValue ? String(nextValue) : null,
        };
        break;
      case "color":
        payload[field.id] = {
          type: "color",
          value: nextValue ? String(nextValue) : null,
        };
        break;
      case "collectionReference":
        payload[field.id] = {
          type: "collectionReference",
          value: resolveCollectionReferenceValue(field, nextValue),
        };
        break;
      case "multiCollectionReference":
        payload[field.id] = {
          type: "multiCollectionReference",
          value: resolveMultiCollectionReferenceValue(field, nextValue),
        };
        break;
      default:
        break;
    }
  }

  return payload;
}

function resolveReferenceOptionId(
  field: DashboardFieldDefinition,
  rawValue: string,
) {
  const value = rawValue.trim();
  const options = field.referenceCollection?.options ?? [];
  const normalizedValue = normalizeLabel(value);
  const matchedOption = options.find(
    (option) =>
      option.id === value ||
      option.slug === value ||
      normalizeLabel(option.label) === normalizedValue,
  );

  if (matchedOption) {
    return matchedOption.id;
  }

  if (options.length === 0) {
    return value;
  }

  throw new AppError(
    `"${field.name}" must match one of the available ${field.referenceCollection?.collectionName ?? "reference"} entries.`,
    400,
  );
}

function resolveCollectionReferenceValue(
  field: DashboardFieldDefinition,
  value: DashboardFieldValue,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const candidate = Array.isArray(value) ? value[0] : value;
  return resolveReferenceOptionId(field, String(candidate));
}

function resolveMultiCollectionReferenceValue(
  field: DashboardFieldDefinition,
  value: DashboardFieldValue,
) {
  if (!Array.isArray(value)) {
    return value ? [resolveReferenceOptionId(field, String(value))] : null;
  }

  return value.map((entry) => resolveReferenceOptionId(field, String(entry)));
}

function resolveEnumCaseValue(
  field: DashboardFieldDefinition,
  value: DashboardFieldValue,
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const rawValue = String(candidate).trim();
  const options = field.options ?? [];
  const normalizedValue = normalizeLabel(rawValue);
  const matchedOption = options.find(
    (option) =>
      option.id === rawValue ||
      option.value === rawValue ||
      normalizeLabel(option.label) === normalizedValue,
  );

  if (!matchedOption) {
    return rawValue;
  }

  return matchedOption.id ?? matchedOption.value;
}

async function maybePublishChanges(
  framer: Framer,
  publishRequested?: boolean,
  metadata: Record<string, unknown> = {},
): Promise<PublishResponse | undefined> {
  if (!publishRequested) {
    return undefined;
  }

  logEvent("info", "framer.publish.started", metadata);

  try {
    const result: PublishResult = await framer.publish();
    const publish = {
      deploymentId: result.deployment.id,
      hostnames: result.hostnames.map((entry) => entry.hostname),
      createdAt: result.deployment.createdAt,
    };

    logEvent("info", "framer.publish.succeeded", {
      ...metadata,
      createdAt: publish.createdAt,
      deploymentId: publish.deploymentId,
      hostnameCount: publish.hostnames.length,
    });

    return publish;
  } catch (error) {
    logError("framer.publish.failed", error, metadata);
    throw error;
  }
}

function areFieldValuesEqual(
  metadata: BlogCollectionMetadata,
  current: Record<string, DashboardFieldValue>,
  next: Record<string, DashboardFieldValue>,
  options?: {
    ignoreAssetFieldDifferences?: boolean;
  },
) {
  return metadata.fields
    .filter((field) => field.supported)
    .every((field) => {
      const currentValue = current[field.id] ?? null;
      const nextValue = next[field.id] ?? null;

      if (
        options?.ignoreAssetFieldDifferences &&
        ["image", "file"].includes(field.type) &&
        typeof currentValue === "string" &&
        typeof nextValue === "string" &&
        currentValue.length > 0 &&
        nextValue.length > 0
      ) {
        return true;
      }

      return JSON.stringify(currentValue) === JSON.stringify(nextValue);
    });
}

function getChangedResult(
  action: BridgeSyncResult["action"],
  externalId: string,
  framerItemId: string,
  matchedBy: BridgeSyncResult["matchedBy"],
  post: BlogPostRecord,
): BridgeSyncResult {
  return {
    externalId,
    framerItemId,
    action,
    matchedBy,
    post,
  };
}

async function syncBridgePluginData(
  item: CollectionItem,
  externalId: string,
  sourceVersion?: string | null,
  current?: {
    externalId?: string | null;
    sourceVersion?: string | null;
  },
) {
  const updates: Promise<void>[] = [];

  if (current?.externalId !== externalId) {
    updates.push(item.setPluginData(BRIDGE_EXTERNAL_ID_KEY, externalId));
  }

  if (sourceVersion && current?.sourceVersion !== sourceVersion) {
    updates.push(item.setPluginData(SOURCE_VERSION_KEY, sourceVersion));
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

export async function getBlogMetadata() {
  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const { metadata } = await getMetadataWithFields(framer, collection);
    return metadata;
  });
}

export async function getDashboardOverview(limit?: number) {
  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      collection.getItems(),
    ]);
    // Limit concurrency to avoid N+1 thundering herd on getPluginData calls.
    // Each serializePost makes 3 getPluginData calls; 10 concurrent = 30 in-flight max.
    const { mapWithConcurrency } = await import("@/lib/shared-utils");
    const serialized = await mapWithConcurrency(items, 10, (item) =>
      serializePost(item, metadata),
    );

    const sorted = serialized.sort((left, right) => {
      const leftDate = Date.parse(left.date ?? left.lastUpdated ?? "") || 0;
      const rightDate = Date.parse(right.date ?? right.lastUpdated ?? "") || 0;
      return rightDate - leftDate;
    });

    return {
      metadata,
      posts: typeof limit === "number" ? sorted.slice(0, limit) : sorted,
    };
  });
}

export async function uploadBlogAsset(
  kind: "file" | "image",
  file: File,
) {
  return withFramerProject(async (framer) => {
    const asset = kind === "image"
      ? await framer.uploadImage(file)
      : await framer.uploadFile(file);

    return {
      thumbnailUrl: "thumbnailUrl" in asset ? asset.thumbnailUrl : null,
      url: asset.url,
    };
  });
}

export async function listBlogPosts() {
  const overview = await getDashboardOverview();
  return overview.posts.map(serializeSummary);
}

export async function getBlogPostById(id: string) {
  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      collection.getItems(),
    ]);
    const item = indexCollectionItems(items).byId.get(id);
    if (!item) {
      throw new AppError("Blog post not found.", 404);
    }

    return serializePost(item, metadata);
  });
}

export async function getEditorBootstrap(id?: string) {
  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      id ? collection.getItems() : Promise.resolve([]),
    ]);

    if (!id) {
      return { metadata, post: null };
    }

    const item = indexCollectionItems(items).byId.get(id);
    if (!item) {
      throw new AppError("Blog post not found.", 404);
    }

    return { metadata, post: await serializePost(item, metadata) };
  });
}

export async function createBlogPost(
  input: UpsertBlogPostInput,
  actor: string,
) {
  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      collection.getItems(),
    ]);
    const itemIndex = indexCollectionItems(items);
    const normalizedSlug = normalizeLabel(input.slug);

    const slugTaken = itemIndex.bySlug.has(normalizedSlug);
    if (slugTaken) {
      throw new AppError(`Slug "${input.slug}" is already in use.`, 409);
    }

    await collection.addItems([
      {
        slug: input.slug,
        draft: input.draft,
        fieldData: buildFieldDataInput(metadata, input),
      },
    ]);

    const persisted = indexCollectionItems(await collection.getItems()).bySlug.get(
      normalizedSlug,
    );
    if (!persisted) {
      throw new AppError("The blog post was created but could not be reloaded.", 500);
    }

    await Promise.all([
      persisted.setPluginData(CREATED_AT_KEY, new Date().toISOString()),
      persisted.setPluginData(LAST_EDITED_AT_KEY, new Date().toISOString()),
      persisted.setPluginData(LAST_EDITED_BY_KEY, actor),
    ]);

    const publish = await maybePublishChanges(framer, input.publish, {
      operation: "createBlogPost",
      postId: persisted.id,
      slug: input.slug,
    });
    return {
      post: await serializePost(persisted, metadata),
      publish,
    };
  });
}

export async function updateBlogPost(
  id: string,
  input: UpsertBlogPostInput,
  actor: string,
) {
  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      collection.getItems(),
    ]);
    const itemIndex = indexCollectionItems(items);
    const normalizedSlug = normalizeLabel(input.slug);

    const existing = itemIndex.byId.get(id);
    if (!existing) {
      logEvent("warn", "framer.updateBlogPost.notFound", {
        postId: id,
        collectionId: collection.id,
        collectionName: collection.name,
        itemCount: items.length,
      });
      throw new AppError("Blog post not found.", 404);
    }

    const slugOwner = itemIndex.bySlug.get(normalizedSlug);
    if (slugOwner && slugOwner.id !== id) {
      throw new AppError(`Slug "${input.slug}" is already in use.`, 409);
    }

    const previous = await serializePost(existing, metadata);
    await collection.addItems([
      {
        id,
        slug: input.slug,
        draft: input.draft,
        fieldData: buildFieldDataInput(metadata, input, previous),
      },
    ]);

    const persisted = indexCollectionItems(await collection.getItems()).byId.get(id);
    if (!persisted) {
      throw new AppError("The updated blog post could not be reloaded.", 500);
    }

    await Promise.all([
      persisted.setPluginData(LAST_EDITED_AT_KEY, new Date().toISOString()),
      persisted.setPluginData(LAST_EDITED_BY_KEY, actor),
    ]);

    const publish = await maybePublishChanges(framer, input.publish, {
      operation: "updateBlogPost",
      postId: persisted.id,
      slug: input.slug,
    });
    return {
      post: await serializePost(persisted, metadata),
      publish,
    };
  });
}

export async function deleteBlogPost(id: string, actor: string) {
  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      collection.getItems(),
    ]);
    const itemIndex = indexCollectionItems(items);

    const existing = itemIndex.byId.get(id);
    if (!existing) {
      throw new AppError("Blog post not found.", 404);
    }

    await collection.removeItems([id]);

    const publish = await maybePublishChanges(framer, true, {
      operation: "deleteBlogPost",
      postId: existing.id,
      slug: existing.slug,
    });

    return {
      postId: id,
      publish,
    };
  });
}

export async function syncBridgePosts(
  inputs: BridgeSyncInput[],
  actor: string,
  publishRequested = false,
): Promise<BridgeSyncResponse> {
  if (inputs.length === 0) {
    return { results: [] };
  }

  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      collection.getItems(),
    ]);

    return syncBridgePostsWithLoadedContext(
      framer,
      collection,
      metadata,
      items,
      inputs,
      actor,
      publishRequested,
    );
  });
}

export async function removeBridgePosts(
  inputs: BridgeRemovalInput[],
  actor: string,
): Promise<BridgeSyncResponse> {
  void actor;

  if (inputs.length === 0) {
    return { results: [] };
  }

  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      collection.getItems(),
    ]);

    return removeBridgePostsWithLoadedContext(
      framer,
      collection,
      metadata,
      items,
      inputs,
    );
  });
}

async function syncBridgePostsWithLoadedContext(
  framer: Framer,
  collection: Collection,
  metadata: BlogCollectionMetadata,
  items: CollectionItem[],
  inputs: BridgeSyncInput[],
  actor: string,
  publishRequested = false,
): Promise<BridgeSyncResponse> {
  logEvent("info", "framer.bridge.sync.started", {
    actor,
    inputCount: inputs.length,
  });

  const itemIndex = indexCollectionItems(items);
  const slugOwners = new Map(
    [...itemIndex.bySlug.entries()].map(([slug, item]) => [slug, item.id] as const),
  );
  const results = new Array<BridgeSyncResult>(inputs.length);
  const changedEntries: Array<{
    index: number;
    action: Extract<BridgeSyncResult["action"], "created" | "updated">;
    externalId: string;
    framerItemId?: string;
    matchedBy: BridgeSyncResult["matchedBy"];
    sourceVersion?: string | null;
    draft: boolean;
    slug: string;
  }> = [];

  for (const [index, input] of inputs.entries()) {
    const desiredSlug = normalizeLabel(input.slug);
    const existingById = input.framerItemId
      ? itemIndex.byId.get(input.framerItemId)
      : undefined;
    const existingBySlug = itemIndex.bySlug.get(desiredSlug);
    const existing = existingById ?? existingBySlug;
    const matchedBy = existingById
      ? "framerItemId"
      : existingBySlug
        ? "slug"
        : "none";
    const slugOwnerId = slugOwners.get(desiredSlug);

    if (slugOwnerId && slugOwnerId !== existing?.id) {
      throw new AppError(`Slug "${input.slug}" is already in use.`, 409);
    }

    if (!existing) {
      await collection.addItems([
        {
          slug: input.slug,
          draft: input.draft,
          fieldData: buildFieldDataInput(metadata, input),
        },
      ]);

      slugOwners.set(desiredSlug, `pending:${input.externalId}`);
      changedEntries.push({
        index,
        action: "created",
        externalId: input.externalId,
        draft: input.draft,
        matchedBy,
        sourceVersion: input.sourceVersion,
        slug: input.slug,
      });
      continue;
    }

    const [previous, existingSourceVersion, existingExternalId] = await Promise.all([
      serializePost(existing, metadata),
      existing.getPluginData(SOURCE_VERSION_KEY),
      existing.getPluginData(BRIDGE_EXTERNAL_ID_KEY),
    ]);
    const bridgePluginData = {
      externalId: existingExternalId,
      sourceVersion: existingSourceVersion,
    };
    const sameSourceVersion = Boolean(
      input.sourceVersion &&
      existingSourceVersion &&
      existingSourceVersion === input.sourceVersion,
    );

    if (sameSourceVersion && previous.slug === input.slug && previous.draft === input.draft) {
      await syncBridgePluginData(existing, input.externalId, input.sourceVersion, bridgePluginData);
      results[index] = getChangedResult(
        "unchanged",
        input.externalId,
        existing.id,
        matchedBy,
        previous,
      );
      continue;
    }

    const unchanged =
      previous.slug === input.slug &&
      previous.draft === input.draft &&
      areFieldValuesEqual(metadata, previous.fieldValues, input.fieldValues);
    const unchangedIgnoringAssetUrls =
      previous.slug === input.slug &&
      previous.draft === input.draft &&
      areFieldValuesEqual(metadata, previous.fieldValues, input.fieldValues, {
        ignoreAssetFieldDifferences: true,
      });

    if (
      input.sourceVersion &&
      !existingSourceVersion &&
      unchangedIgnoringAssetUrls
    ) {
      await syncBridgePluginData(existing, input.externalId, input.sourceVersion, bridgePluginData);
      results[index] = getChangedResult(
        "unchanged",
        input.externalId,
        existing.id,
        matchedBy,
        previous,
      );
      continue;
    }

    if (unchanged) {
      await syncBridgePluginData(existing, input.externalId, input.sourceVersion, bridgePluginData);
      results[index] = getChangedResult(
        "unchanged",
        input.externalId,
        existing.id,
        matchedBy,
        previous,
      );
      continue;
    }

    if (normalizeLabel(existing.slug) !== desiredSlug) {
      const previousSlug = normalizeLabel(existing.slug);
      slugOwners.delete(previousSlug);
      itemIndex.bySlug.delete(previousSlug);
      itemIndex.bySlug.set(desiredSlug, existing);
      slugOwners.set(desiredSlug, existing.id);
    }

    await collection.addItems([
      {
        id: existing.id,
        slug: input.slug,
        draft: input.draft,
        fieldData: buildFieldDataInput(metadata, input, previous),
      },
    ]);

    changedEntries.push({
      index,
      action: "updated",
      externalId: input.externalId,
      framerItemId: existing.id,
      draft: input.draft,
      matchedBy,
      sourceVersion: input.sourceVersion,
      slug: input.slug,
    });
  }

  let publish: PublishResponse | undefined;

  if (changedEntries.length > 0) {
    const persistedItems = await collection.getItems();

    for (const entry of changedEntries) {
      let persisted = entry.framerItemId
        ? persistedItems.find((item) => item.id === entry.framerItemId)
        : persistedItems.find(
            (item) => normalizeLabel(item.slug) === normalizeLabel(entry.slug),
          );

      if (!persisted) {
        throw new AppError(
          `The synced blog post "${entry.slug}" could not be reloaded.`,
          500,
        );
      }

      if (persisted.draft !== entry.draft) {
        const updated = await persisted.setAttributes({ draft: entry.draft });
        if (!updated) {
          throw new AppError(
            `The synced blog post "${entry.slug}" could not be updated to the requested draft state.`,
            500,
          );
        }

        persisted = updated;

        if (persisted.draft !== entry.draft) {
          throw new AppError(
            `Framer did not apply draft=${entry.draft} for "${entry.slug}".`,
            502,
          );
        }
      }

      await Promise.all([
        entry.action === "created"
          ? persisted.setPluginData(CREATED_AT_KEY, new Date().toISOString())
          : Promise.resolve(),
        persisted.setPluginData(LAST_EDITED_AT_KEY, new Date().toISOString()),
        persisted.setPluginData(LAST_EDITED_BY_KEY, actor),
        persisted.setPluginData(BRIDGE_EXTERNAL_ID_KEY, entry.externalId),
        entry.sourceVersion
          ? persisted.setPluginData(SOURCE_VERSION_KEY, entry.sourceVersion)
          : Promise.resolve(),
      ]);

      results[entry.index] = getChangedResult(
        entry.action,
        entry.externalId,
        persisted.id,
        entry.matchedBy,
        await serializePost(persisted, metadata),
      );
    }

    publish = await maybePublishChanges(framer, publishRequested, {
      actor,
      changedCount: changedEntries.length,
      inputCount: inputs.length,
      operation: "syncBridgePosts",
    });
  }

  logEvent("info", "framer.bridge.sync.succeeded", {
    actor,
    changedCount: changedEntries.length,
    createdCount: results.filter((entry) => entry.action === "created").length,
    inputCount: inputs.length,
    publishCreatedAt: publish?.createdAt ?? null,
    unchangedCount: results.filter((entry) => entry.action === "unchanged").length,
    updatedCount: results.filter((entry) => entry.action === "updated").length,
  });

  return {
    results,
    publish,
  };
}

async function removeBridgePostsWithLoadedContext(
  framer: Framer,
  collection: Collection,
  metadata: BlogCollectionMetadata,
  items: CollectionItem[],
  inputs: BridgeRemovalInput[],
): Promise<BridgeSyncResponse> {
  logEvent("info", "framer.bridge.remove.started", {
    inputCount: inputs.length,
  });

  const itemIndex = indexCollectionItems(items);
  const removedIds = new Set<string>();
  const removedEntries: Array<{
    externalId: string;
    framerItemId: string;
    matchedBy: BridgeSyncResult["matchedBy"];
    post: BlogPostRecord;
  }> = [];

  for (const input of inputs) {
    const inputSlug = input.slug ?? null;
    const existingById = input.framerItemId
      ? itemIndex.byId.get(input.framerItemId)
      : undefined;
    const existingBySlug = inputSlug
      ? itemIndex.bySlug.get(normalizeLabel(inputSlug))
      : undefined;

    let matchedBy: BridgeSyncResult["matchedBy"] = "none";
    let matchedItem: CollectionItem | undefined;

    if (existingById) {
      const linkedExternalId = await existingById.getPluginData(BRIDGE_EXTERNAL_ID_KEY);
      if (!linkedExternalId || linkedExternalId === input.externalId) {
        matchedItem = existingById;
        matchedBy = "framerItemId";
      }
    }

    if (!matchedItem && existingBySlug) {
      const linkedExternalId = await existingBySlug.getPluginData(BRIDGE_EXTERNAL_ID_KEY);
      if (linkedExternalId === input.externalId) {
        matchedItem = existingBySlug;
        matchedBy = "slug";
      }
    }

    if (!matchedItem || removedIds.has(matchedItem.id)) {
      continue;
    }

    removedIds.add(matchedItem.id);
    removedEntries.push({
      externalId: input.externalId,
      framerItemId: matchedItem.id,
      matchedBy,
      post: await serializePost(matchedItem, metadata),
    });
  }

  if (removedEntries.length === 0) {
    logEvent("info", "framer.bridge.remove.succeeded", {
      deletedCount: 0,
      inputCount: inputs.length,
      publishCreatedAt: null,
    });
    return { results: [] };
  }

  await collection.removeItems(removedEntries.map((entry) => entry.framerItemId));
  const publish = await maybePublishChanges(framer, true, {
    deletedCount: removedEntries.length,
    inputCount: inputs.length,
    operation: "removeBridgePosts",
  });

  logEvent("info", "framer.bridge.remove.succeeded", {
    deletedCount: removedEntries.length,
    inputCount: inputs.length,
    publishCreatedAt: publish?.createdAt ?? null,
  });

  return {
    results: removedEntries.map((entry) =>
      getChangedResult(
        "deleted",
        entry.externalId,
        entry.framerItemId,
        entry.matchedBy,
        entry.post,
      )),
    publish,
  };
}

export async function syncBridgePostsFromRaw<T>(
  rawInputs: T[],
  actor: string,
  mapInput: (metadata: BlogCollectionMetadata, rawInput: T) => BridgeSyncInput,
): Promise<BridgeSyncResponse> {
  if (rawInputs.length === 0) {
    return { results: [] };
  }

  return withFramerProject(async (framer) => {
    const collection = await getBlogCollection(framer);
    const [{ metadata }, items] = await Promise.all([
      getMetadataWithFields(framer, collection),
      collection.getItems(),
    ]);
    const inputs = rawInputs.map((rawInput) => mapInput(metadata, rawInput));
    return syncBridgePostsWithLoadedContext(
      framer,
      collection,
      metadata,
      items,
      inputs,
      actor,
    );
  });
}

// ---------------------------------------------------------------------------
// Generic Framer project operations (not scoped to the blog collection)
// ---------------------------------------------------------------------------

export async function getProjectInfo() {
  return withFramerProject(async (framer) => {
    const info = await framer.getProjectInfo();
    return { id: info.id, name: info.name };
  });
}

export async function getPublishInfo() {
  return withFramerProject(async (framer) => {
    return framer.getPublishInfo();
  });
}

export async function publishSite() {
  return withFramerProject(async (framer) => {
    const result = await framer.publish();
    return {
      deploymentId: result.deployment.id,
      createdAt: result.deployment.createdAt,
      hostnames: result.hostnames.map((h) => ({
        hostname: h.hostname,
        type: h.type,
        isPrimary: h.isPrimary,
      })),
    };
  });
}

export async function getAllCollections() {
  return withFramerProject(async (framer) => {
    const collections = await framer.getCollections();
    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      managedBy: c.managedBy,
      readonly: c.readonly,
      slugFieldName: c.slugFieldName,
      slugFieldBasedOn: c.slugFieldBasedOn,
    }));
  });
}

export async function getCollectionById(collectionId: string) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    return {
      id: collection.id,
      name: collection.name,
      managedBy: collection.managedBy,
      readonly: collection.readonly,
      slugFieldName: collection.slugFieldName,
      slugFieldBasedOn: collection.slugFieldBasedOn,
    };
  });
}

export async function getCollectionFields(collectionId: string) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const fields = await collection.getFields();
    return fields.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      ...(f.type === "enum" ? { cases: f.cases.map((c) => ({ id: c.id, name: c.name })) } : {}),
      ...("required" in f && typeof f.required === "boolean" ? { required: f.required } : {}),
      ...("collectionId" in f && typeof f.collectionId === "string"
        ? { collectionId: f.collectionId }
        : {}),
    }));
  });
}

function serializeFieldData(fieldData: Record<string, { type: string; value: unknown }>) {
  const result: Record<string, unknown> = {};
  for (const [fieldId, entry] of Object.entries(fieldData)) {
    if (!entry) continue;
    if (entry.type === "image") {
      const img = entry.value as { url?: string; altText?: string } | null;
      result[fieldId] = img?.url
        ? { url: img.url, alt: img.altText ?? null }
        : null;
    } else if (entry.type === "file") {
      result[fieldId] = (entry.value as { url?: string } | null)?.url ?? null;
    } else if (entry.type === "multiCollectionReference") {
      result[fieldId] = [...(entry.value as string[])];
    } else if (entry.type === "formattedText") {
      // Truncate long HTML bodies to avoid blowing up streaming JSON responses
      const text = (entry.value as string) ?? "";
      result[fieldId] = text.length > 500 ? text.slice(0, 500) + "…[truncated]" : text;
    } else {
      result[fieldId] = entry.value ?? null;
    }
  }
  return result;
}

export async function getCollectionItems(collectionId: string) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const items = await collection.getItems();

    // Include field metadata so the chat UI can render human-readable columns and image cells.
    const _fieldNames: Record<string, string> = {};
    const _fieldTypes: Record<string, string> = {};

    try {
      const fields = await collection.getFields();
      for (const f of fields) {
        _fieldNames[f.id] = f.name;
        _fieldTypes[f.id] = f.type;
      }
    } catch (error) {
      logError("framer.collection.getItems.fields_failed", error, {
        collectionId,
      });
    }

    return {
      _fieldNames,
      _fieldTypes,
      items: items.map((item) => ({
        id: item.id,
        slug: item.slug,
        draft: item.draft,
        fieldData: serializeFieldData(
          item.fieldData as unknown as Record<string, { type: string; value: unknown }>,
        ),
      })),
    };
  });
}

export async function addCollectionItems(
  collectionId: string,
  items: Array<{
    id?: string;
    slug: string;
    draft?: boolean;
    fieldData?: Record<string, { type: string; value: unknown }>;
  }>,
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    await collection.addItems(
      items.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        slug: item.slug,
        draft: item.draft,
        fieldData: (item.fieldData ?? {}) as FieldDataInput,
      })),
    );
    logEvent("info", "framer.collection.addItems", {
      collectionId,
      itemCount: items.length,
    });
    return { success: true, itemCount: items.length };
  });
}

export async function removeCollectionItems(
  collectionId: string,
  itemIds: string[],
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    await collection.removeItems(itemIds);
    logEvent("info", "framer.collection.removeItems", {
      collectionId,
      removedCount: itemIds.length,
    });
    return { success: true, removedCount: itemIds.length };
  });
}

export async function setCollectionItemAttributes(
  collectionId: string,
  itemId: string,
  attributes: {
    slug?: string;
    draft?: boolean;
    fieldData?: Record<string, { type: string; value: unknown }>;
  },
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const items = await collection.getItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      throw new AppError(`Item "${itemId}" not found in collection.`, 404);
    }
    const updated = await item.setAttributes({
      ...(attributes.slug !== undefined ? { slug: attributes.slug } : {}),
      ...(attributes.draft !== undefined ? { draft: attributes.draft } : {}),
      ...(attributes.fieldData
        ? { fieldData: attributes.fieldData as unknown as FieldDataInput }
        : {}),
    });
    if (!updated) {
      throw new AppError("Item was deleted before update could complete.", 404);
    }
    logEvent("info", "framer.collection.setItemAttributes", {
      collectionId,
      itemId,
    });
    return {
      id: updated.id,
      slug: updated.slug,
      draft: updated.draft,
      fieldData: serializeFieldData(
        updated.fieldData as unknown as Record<string, { type: string; value: unknown }>,
      ),
    };
  });
}

export async function removeCollectionItem(
  collectionId: string,
  itemId: string,
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const items = await collection.getItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      throw new AppError(`Item "${itemId}" not found in collection.`, 404);
    }
    await item.remove();
    logEvent("info", "framer.collection.removeItem", {
      collectionId,
      itemId,
    });
    return { success: true, itemId };
  });
}

export async function getEnumFieldCases(
  collectionId: string,
  fieldId: string,
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const fields = await collection.getFields();
    const field = fields.find((f) => f.id === fieldId);
    if (!field || field.type !== "enum") {
      throw new AppError(`Field "${fieldId}" is not an enum field.`, 400);
    }
    return field.cases.map((c) => ({ id: c.id, name: c.name }));
  });
}

export async function addEnumCase(
  collectionId: string,
  fieldId: string,
  name: string,
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const fields = await collection.getFields();
    const field = fields.find((f) => f.id === fieldId);
    if (!field || field.type !== "enum") {
      throw new AppError(`Field "${fieldId}" is not an enum field.`, 400);
    }
    const newCase = await field.addCase({ name });
    if (!newCase) {
      throw new AppError("Failed to add enum case.", 500);
    }
    logEvent("info", "framer.enum.addCase", { collectionId, fieldId, caseName: name });
    return { id: newCase.id, name: newCase.name };
  });
}

export async function setEnumCaseOrder(
  collectionId: string,
  fieldId: string,
  caseIds: string[],
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const fields = await collection.getFields();
    const field = fields.find((f) => f.id === fieldId);
    if (!field || field.type !== "enum") {
      throw new AppError(`Field "${fieldId}" is not an enum field.`, 400);
    }
    await field.setCaseOrder(caseIds);
    logEvent("info", "framer.enum.setCaseOrder", { collectionId, fieldId });
    return { success: true };
  });
}

export async function updateEnumCase(
  collectionId: string,
  fieldId: string,
  caseId: string,
  newName: string,
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const fields = await collection.getFields();
    const field = fields.find((f) => f.id === fieldId);
    if (!field || field.type !== "enum") {
      throw new AppError(`Field "${fieldId}" is not an enum field.`, 400);
    }
    const enumCase = field.cases.find((c) => c.id === caseId);
    if (!enumCase) {
      throw new AppError(`Enum case "${caseId}" not found.`, 404);
    }
    const updated = await enumCase.setAttributes({ name: newName });
    if (!updated) {
      throw new AppError("Enum case was removed before update.", 404);
    }
    logEvent("info", "framer.enum.updateCase", { collectionId, fieldId, caseId });
    return { id: updated.id, name: updated.name };
  });
}

export async function removeEnumCase(
  collectionId: string,
  fieldId: string,
  caseId: string,
) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    const fields = await collection.getFields();
    const field = fields.find((f) => f.id === fieldId);
    if (!field || field.type !== "enum") {
      throw new AppError(`Field "${fieldId}" is not an enum field.`, 400);
    }
    const enumCase = field.cases.find((c) => c.id === caseId);
    if (!enumCase) {
      throw new AppError(`Enum case "${caseId}" not found.`, 404);
    }
    await enumCase.remove();
    logEvent("info", "framer.enum.removeCase", { collectionId, fieldId, caseId });
    return { success: true, caseId };
  });
}

export async function setCollectionAsActive(collectionId: string) {
  return withFramerProject(async (framer) => {
    const collection = await framer.getCollection(collectionId);
    if (!collection) {
      throw new AppError(`Collection "${collectionId}" not found.`, 404);
    }
    await collection.setAsActive();
    logEvent("info", "framer.collection.setAsActive", { collectionId });
    return { success: true, collectionId };
  });
}
