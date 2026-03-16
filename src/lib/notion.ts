import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  BridgeSyncResult,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";
import {
  getNotionBridgeEnvIssues,
  getNotionFieldMap,
  getServerEnv,
  isNotionBridgeConfigured,
} from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";
import {
  getBlogMetadata,
  getDashboardOverview,
  removeBridgePosts,
  syncBridgePosts,
  syncBridgePostsFromRaw,
} from "@/lib/framer";
import {
  buildBridgeSyncInput,
  extractPropertyValue,
  getBridgePageIdentifiers,
  getPropertyByName,
  getPropertyByPatterns,
  getStatusValue,
  isActivePage,
  isApprovedPage,
  LOGICAL_FIELD_PATTERNS,
  normalizeLabel,
  type NotionPage,
  type NotionProperty,
  syncNotionPageToFramer,
} from "@/lib/notion-bridge-core";
import { extractPageIdFromPayload } from "@/lib/notion-payload";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2025-09-03";
const NOTION_MARKDOWN_WRITE_VERSION = "2026-03-11";
const NOTION_MARKDOWN_CONCURRENCY = 5;
const NOTION_RICH_TEXT_CHUNK_SIZE = 2_000;
const DATA_SOURCE_CACHE_TTL_MS = 5 * 60 * 1_000;

const FRAMER_AUDIT_PROPERTY_PATTERNS = {
  createdAt: ["framer created at", "cms created at", "created at"],
  lastUpdated: ["framer updated at", "cms updated at", "last updated", "updated at"],
  lastUpdatedBy: ["framer updated by", "cms updated by", "last updated by", "updated by"],
} as const;

type NotionDataSourceProperty = {
  id: string;
  name?: string;
  type: string;
};

type NotionDataSource = {
  id: string;
  properties: Record<string, NotionDataSourceProperty>;
};

type NotionQueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

type NotionPropertyPayload = Record<string, unknown>;

type NotionPropertyUpdate = {
  payload: NotionPropertyPayload;
  comparisonValue: DashboardFieldValue;
};

type FramerImportResult = {
  framerItemId: string;
  notionPageId: string;
  notionPageUrl: string | null;
  title: string;
  slug: string;
  action: "created" | "updated" | "unchanged";
  matchedBy: "framerItemId" | "slug" | "none";
};

type NotionDataSourceWithMetadata = NotionDataSource & { _isLegacyDatabase?: boolean };

type NotionDataSourceCacheEntry = {
  configuredId: string;
  expiresAt: number;
  value: NotionDataSourceWithMetadata;
};

type DataSourceResolutionMethod =
  | "configuredDataSource"
  | "configuredDatabase"
  | "configuredLegacyDatabase"
  | "searchParentDatabase"
  | "searchOnlyResult";

let cachedDataSource: NotionDataSourceCacheEntry | null = null;

function readCachedDataSource(configuredId: string) {
  if (
    cachedDataSource &&
    cachedDataSource.configuredId === configuredId &&
    cachedDataSource.expiresAt > Date.now()
  ) {
    return cachedDataSource.value;
  }

  cachedDataSource = null;
  return null;
}

function writeCachedDataSource(
  configuredId: string,
  value: NotionDataSourceWithMetadata,
) {
  cachedDataSource = {
    configuredId,
    expiresAt: Date.now() + DATA_SOURCE_CACHE_TTL_MS,
    value,
  };

  return value;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  mapItem: (item: T, index: number) => Promise<TResult>,
) {
  if (items.length === 0) {
    return [] as TResult[];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapItem(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

export function getNotionBridgeStatus() {
  const env = getServerEnv();

  return {
    configured: isNotionBridgeConfigured(),
    issues: getNotionBridgeEnvIssues(),
    webhookPath: "/api/notion/webhook",
    manualSyncPath: "/api/notion/sync",
    manualImportPath: "/api/notion/import",
    dataSourceId: env.NOTION_DATA_SOURCE_ID ?? null,
    statusPropertyName: env.NOTION_STATUS_PROPERTY_NAME,
    approvedStatusValue: env.NOTION_APPROVED_STATUS_VALUE,
    slugPropertyName: env.NOTION_SLUG_PROPERTY_NAME,
    framerItemIdPropertyName: env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME,
    responsePropertyName: env.NOTION_RESPONSE_PROPERTY_NAME,
    fieldMap: getNotionFieldMap(),
  };
}

function getNotionBridgeConfig() {
  const env = getServerEnv();

  return {
    approvedStatusValue: env.NOTION_APPROVED_STATUS_VALUE,
    fieldMap: getNotionFieldMap(),
    framerItemIdPropertyName: env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME,
    responsePropertyName: env.NOTION_RESPONSE_PROPERTY_NAME,
    slugPropertyName: env.NOTION_SLUG_PROPERTY_NAME,
    statusPropertyName: env.NOTION_STATUS_PROPERTY_NAME,
  };
}

function getRequestSecret(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  const headerSecret = request.headers.get("x-notion-bridge-secret")?.trim() ?? "";
  const secrets: string[] = [];

  if (authorization) {
    if (!authorization.startsWith("Bearer ")) {
      return null;
    }

    const bearerSecret = authorization.slice("Bearer ".length).trim();
    if (!bearerSecret) {
      return null;
    }

    secrets.push(bearerSecret);
  }

  if (headerSecret) {
    secrets.push(headerSecret);
  }

  return secrets.length === 1 ? secrets[0] : null;
}

function secretsMatch(providedSecret: string | null, expectedSecret: string | undefined) {
  if (!providedSecret || !expectedSecret) {
    return false;
  }

  const providedDigest = createHash("sha256").update(providedSecret).digest();
  const expectedDigest = createHash("sha256").update(expectedSecret).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export function assertBridgeRequestAuthorized(request: Request) {
  assertNotionBridgeConfigured();

  if (secretsMatch(getRequestSecret(request), getServerEnv().NOTION_WEBHOOK_SECRET)) {
    return;
  }

  throw new AppError("Unauthorized bridge request.", 401);
}

function assertNotionBridgeConfigured() {
  if (isNotionBridgeConfigured()) {
    return;
  }

  const issues = getNotionBridgeEnvIssues();
  if (issues.length === 0) {
    throw new AppError("The Notion bridge is not configured.", 503);
  }

  throw new AppError(
    `The Notion bridge is not configured correctly: ${issues
      .map((issue) => `${issue.path} (${issue.message})`)
      .join(", ")}`,
    503,
  );
}

async function notionRequest<T>(
  path: string,
  init: RequestInit = {},
  options?: {
    notionVersion?: string;
  },
): Promise<T> {
  assertNotionBridgeConfigured();

  const env = getServerEnv();
  const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": options?.notionVersion ?? NOTION_API_VERSION,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new AppError(
      payload?.message ?? `Notion API request failed for ${path}.`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const rawBody = await response.text();
  if (!rawBody.trim()) {
    return undefined as T;
  }

  return JSON.parse(rawBody) as T;
}

async function getDataSource() {
  const env = getServerEnv();
  const configuredId = env.NOTION_DATA_SOURCE_ID ?? "";
  if (!configuredId) {
    throw new AppError("NOTION_DATA_SOURCE_ID is required to resolve the Notion data source.", 503);
  }
  const cached = readCachedDataSource(configuredId);

  if (cached) {
    return cached;
  }

  const diagnostics: Array<{ strategy: string; error: string }> = [];
  const resolveWithCache = (
    value: NotionDataSourceWithMetadata,
    method: DataSourceResolutionMethod,
    metadata: Record<string, unknown> = {},
  ) => {
    const resolved = writeCachedDataSource(configuredId, value);

    if (method !== "configuredDataSource") {
      logEvent("warn", "notion.getDataSource.fallbackResolved", {
        configuredId,
        resolvedDataSourceId: resolved.id,
        resolvedBy: method,
        diagnostics,
        ...metadata,
      });
    }

    return resolved;
  };

  try {
    return resolveWithCache(
      await notionRequest<NotionDataSource>(`/data_sources/${configuredId}`),
      "configuredDataSource",
    );
  } catch (dsError) {
    diagnostics.push({
      strategy: "configuredDataSource",
      error: dsError instanceof Error ? dsError.message : String(dsError),
    });
  }

  type NotionDatabaseResponse = {
    id: string;
    object?: string;
    properties?: Record<string, { id: string; name?: string; type: string }>;
    data_sources?: Array<{ id: string; name?: string }>;
  };

  try {
    const database = await notionRequest<NotionDatabaseResponse>(`/databases/${configuredId}`);
    const firstDataSource = database.data_sources?.[0];

    if (firstDataSource) {
      return resolveWithCache(
        await notionRequest<NotionDataSource>(`/data_sources/${firstDataSource.id}`),
        "configuredDatabase",
      );
    }

    if (database.properties) {
      const reshapedProperties: Record<string, NotionDataSourceProperty> = {};
      for (const [name, prop] of Object.entries(database.properties)) {
        reshapedProperties[name] = { id: prop.id, name: prop.name ?? name, type: prop.type };
      }

      return resolveWithCache(
        {
          id: database.id,
          properties: reshapedProperties,
          _isLegacyDatabase: true,
        },
        "configuredLegacyDatabase",
        {
          propertyCount: Object.keys(database.properties).length,
        },
      );
    }
  } catch (dbError) {
    diagnostics.push({
      strategy: "configuredDatabase",
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
  }

  try {
    const legacyDb = await notionRequest<NotionDatabaseResponse>(
      `/databases/${configuredId}`,
      {},
      { notionVersion: "2022-06-28" },
    );

    if (legacyDb.properties) {
      const reshapedProperties: Record<string, NotionDataSourceProperty> = {};
      for (const [name, prop] of Object.entries(legacyDb.properties)) {
        reshapedProperties[name] = { id: prop.id, name: prop.name ?? name, type: prop.type };
      }

      return resolveWithCache(
        {
          id: legacyDb.id,
          properties: reshapedProperties,
          _isLegacyDatabase: true,
        },
        "configuredLegacyDatabase",
        {
          propertyCount: Object.keys(legacyDb.properties).length,
        },
      );
    }
  } catch (legacyError) {
    diagnostics.push({
      strategy: "configuredLegacyDatabase",
      error: legacyError instanceof Error ? legacyError.message : String(legacyError),
    });
  }

  try {
    type SearchResponse = {
      results: Array<{ id: string; object: string; parent?: Record<string, unknown> }>;
    };
    const searchResult = await notionRequest<SearchResponse>("/search", {
      method: "POST",
      body: JSON.stringify({
        filter: { value: "data_source", property: "object" },
        page_size: 20,
      }),
    });
    const matchByParent = searchResult.results.find((ds) => {
      const parentDbId = (ds.parent as { database_id?: string })?.database_id;
      return parentDbId === configuredId;
    });
    const resolved =
      matchByParent ?? (searchResult.results.length === 1 ? searchResult.results[0] : null);

    if (resolved) {
      return resolveWithCache(
        await notionRequest<NotionDataSource>(`/data_sources/${resolved.id}`),
        matchByParent ? "searchParentDatabase" : "searchOnlyResult",
        {
          searchResultCount: searchResult.results.length,
        },
      );
    }

    diagnostics.push({
      strategy: "search",
      error: `search returned ${searchResult.results.length} accessible data sources`,
    });
  } catch (searchError) {
    diagnostics.push({
      strategy: "search",
      error: searchError instanceof Error ? searchError.message : String(searchError),
    });
  }

  throw new AppError(
    `Could not resolve NOTION_DATA_SOURCE_ID "${configuredId}" as a data source or database. ` +
    `Update it to the actual Notion data source ID to avoid fallback resolution.`,
    400,
  );
}

function getStatusFilterProperty(dataSource: NotionDataSource) {
  const env = getServerEnv();
  const property = dataSource.properties[env.NOTION_STATUS_PROPERTY_NAME];

  if (!property) {
    throw new AppError(
      `The Notion status property "${env.NOTION_STATUS_PROPERTY_NAME}" was not found in the configured data source.`,
      400,
    );
  }

  switch (property.type) {
    case "status":
      return {
        property: env.NOTION_STATUS_PROPERTY_NAME,
        status: {
          equals: env.NOTION_APPROVED_STATUS_VALUE,
        },
      };
    case "select":
      return {
        property: env.NOTION_STATUS_PROPERTY_NAME,
        select: {
          equals: env.NOTION_APPROVED_STATUS_VALUE,
        },
      };
    case "checkbox":
      return {
        property: env.NOTION_STATUS_PROPERTY_NAME,
        checkbox: {
          equals: env.NOTION_APPROVED_STATUS_VALUE.toLowerCase() === "true",
        },
      };
    default:
      throw new AppError(
        `The Notion status property "${env.NOTION_STATUS_PROPERTY_NAME}" must be a status, select, or checkbox property.`,
        400,
      );
  }
}

async function queryDataSourcePages(
  dataSource: NotionDataSource & { _isLegacyDatabase?: boolean },
  filter?: Record<string, unknown>,
) {
  const isLegacy = (dataSource as { _isLegacyDatabase?: boolean })._isLegacyDatabase;
  const queryPath = isLegacy
    ? `/databases/${dataSource.id}/query`
    : `/data_sources/${dataSource.id}/query`;
  const pages: NotionPage[] = [];
  let nextCursor: string | null = null;

  do {
    const payload: NotionQueryResponse = await notionRequest<NotionQueryResponse>(
      queryPath,
      {
        method: "POST",
        body: JSON.stringify({
          filter: filter ?? undefined,
          sorts: [
            {
              timestamp: "last_edited_time",
              direction: "descending",
            },
          ],
          page_size: 100,
          start_cursor: nextCursor ?? undefined,
        }),
      },
    );

    pages.push(...payload.results.filter(isActivePage));
    nextCursor = payload.has_more ? payload.next_cursor : null;
  } while (nextCursor);

  return pages;
}

async function queryApprovedPages() {
  const dataSource = await getDataSource();
  return queryDataSourcePages(dataSource, getStatusFilterProperty(dataSource));
}

async function queryAllPages() {
  const dataSource = await getDataSource();
  return {
    dataSource,
    pages: await queryDataSourcePages(dataSource),
  };
}

async function getPage(pageId: string) {
  return notionRequest<NotionPage>(`/pages/${pageId}`);
}

async function getPageMarkdown(pageId: string) {
  assertNotionBridgeConfigured();

  const env = getServerEnv();
  const response = await fetch(`${NOTION_API_BASE_URL}/pages/${pageId}/markdown`, {
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_API_VERSION,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new AppError(
      payload?.message ?? `Notion markdown request failed for page ${pageId}.`,
      response.status,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { markdown?: string };
    return payload.markdown?.trim() ?? "";
  }

  return (await response.text()).trim();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unexpected bridge error.";
}

function buildFailedResponseMessage(error: unknown) {
  return `Failed at ${new Date().toISOString()}: ${getErrorMessage(error)}`;
}

function buildRemovedResponseMessage(result: BridgeSyncResult) {
  return `Success at ${new Date().toISOString()}: removed linked Framer post "${result.post.slug}" (${result.framerItemId}).`;
}

function buildSkippedResponseMessage(reason: string) {
  return `Skipped at ${new Date().toISOString()}: ${reason}`;
}

function buildSyncedResponseMessage(
  result: BridgeSyncResult,
  options?: { draftedBecauseUnapproved?: boolean },
) {
  const timestamp = new Date().toISOString();

  if (options?.draftedBecauseUnapproved) {
    return `Success at ${timestamp}: synced "${result.post.slug}" to Framer as a draft because the page is not approved (${result.framerItemId}, action ${result.action}).`;
  }

  switch (result.action) {
    case "created":
      return `Success at ${timestamp}: created ${result.post.draft ? "draft" : "published"} Framer post "${result.post.slug}" (${result.framerItemId}).`;
    case "updated":
      return `Success at ${timestamp}: updated ${result.post.draft ? "draft" : "published"} Framer post "${result.post.slug}" (${result.framerItemId}).`;
    case "unchanged":
      return `Success at ${timestamp}: no content changes for "${result.post.slug}"; linked Framer post is ${result.framerItemId}.`;
    case "deleted":
      return buildRemovedResponseMessage(result);
    default:
      return `Success at ${timestamp}: synced "${result.post.slug}" (${result.framerItemId}).`;
  }
}

async function resolveResponseProperty(
  page: NotionPage,
): Promise<{
  currentValue: DashboardFieldValue;
  propertyName: string;
  propertyType: string;
} | null> {
  const configuredName = getServerEnv().NOTION_RESPONSE_PROPERTY_NAME;
  const pageEntry = getPropertyByName(page.properties, configuredName);

  if (pageEntry) {
    return {
      currentValue: extractPropertyValue(pageEntry[1]),
      propertyName: pageEntry[0],
      propertyType: pageEntry[1].type,
    };
  }

  const dataSource = await getDataSource().catch(() => null);
  const dataSourceEntry = dataSource
    ? getPropertyByName(dataSource.properties, configuredName)
    : null;

  if (!dataSourceEntry) {
    return null;
  }

  return {
    currentValue: null,
    propertyName: dataSourceEntry[0],
    propertyType: dataSourceEntry[1].type,
  };
}

async function updateResponseOnPage(page: NotionPage, message: string) {
  const resolvedProperty = await resolveResponseProperty(page);
  if (!resolvedProperty) {
    logEvent("warn", "notion.sync.response.missingProperty", {
      configuredPropertyName: getServerEnv().NOTION_RESPONSE_PROPERTY_NAME,
      pageId: page.id,
      propertyNames: Object.keys(page.properties),
    });
    return false;
  }

  const { currentValue, propertyName, propertyType } = resolvedProperty;

  if (currentValue === message) {
    logEvent("info", "notion.sync.response.unchanged", {
      pageId: page.id,
      propertyName,
    });
    return false;
  }

  if (propertyType === "rich_text") {
    await notionRequest(`/pages/${page.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          [propertyName]: {
            rich_text: toNotionRichText(message),
          },
        },
      }),
    });
    logEvent("info", "notion.sync.response.updated", {
      pageId: page.id,
      propertyName,
      propertyType,
    });
    return true;
  }

  if (propertyType === "title") {
    await notionRequest(`/pages/${page.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          [propertyName]: {
            title: toNotionRichText(message),
          },
        },
      }),
    });
    logEvent("info", "notion.sync.response.updated", {
      pageId: page.id,
      propertyName,
      propertyType,
    });
    return true;
  }

  logEvent("warn", "notion.sync.response.unsupportedPropertyType", {
    pageId: page.id,
    propertyName,
    propertyType,
  });
  return false;
}

async function recordResponseOnPage(page: NotionPage, message: string) {
  try {
    await updateResponseOnPage(page, message);
  } catch (error) {
    logError("notion.sync.response.failed", error, {
      pageId: page.id,
      propertyName: getServerEnv().NOTION_RESPONSE_PROPERTY_NAME,
    });
  }
}

async function updateFramerItemIdOnPage(
  page: NotionPage,
  framerItemId: string,
) {
  const env = getServerEnv();
  const property = page.properties[env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME];
  if (!property) {
    return false;
  }

  const currentValue = extractPropertyValue(property);
  if (currentValue === framerItemId) {
    return false;
  }

  if (property.type === "rich_text") {
    await notionRequest(`/pages/${page.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          [env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME]: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: framerItemId,
                },
              },
            ],
          },
        },
      }),
    });
    return true;
  }

  if (property.type === "url") {
    await notionRequest(`/pages/${page.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          [env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME]: {
            url: framerItemId,
          },
        },
      }),
    });
    return true;
  }

  throw new AppError(
    `The Notion property "${env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME}" must be a rich_text or url property to store the synced Framer item ID.`,
    400,
  );
}

async function buildSyncCandidates(pages: NotionPage[]) {
  const candidates = await mapWithConcurrency(
    pages,
    NOTION_MARKDOWN_CONCURRENCY,
    async (page) => ({
      page,
      markdownBody: await getPageMarkdown(page.id),
    }),
  );
  const pageMap = new Map(pages.map((page) => [page.id, page]));

  return {
    candidates,
    pageMap,
  };
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, rawCode) => {
    const code = String(rawCode).toLowerCase();

    if (code in namedEntities) {
      return namedEntities[code];
    }

    if (code.startsWith("#x")) {
      const parsed = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : entity;
    }

    if (code.startsWith("#")) {
      const parsed = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : entity;
    }

    return entity;
  });
}

function stripResidualHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<\/?[^>]+>/g, ""));
}

function normalizeMarkdownContent(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function convertHtmlToMarkdown(value: string) {
  let output = value.replace(/\r\n?/g, "\n");

  output = output
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
      (_, src: string, alt: string) => `![${decodeHtmlEntities(alt)}](${src})`,
    )
    .replace(
      /<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi,
      (_, alt: string, src: string) => `![${decodeHtmlEntities(alt)}](${src})`,
    )
    .replace(
      /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, text: string) => {
        const label = stripResidualHtml(text).trim() || href;
        return `[${label}](${href})`;
      },
    )
    .replace(
      /<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi,
      (_, __: string, content: string) => `**${stripResidualHtml(content)}**`,
    )
    .replace(
      /<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi,
      (_, __: string, content: string) => `*${stripResidualHtml(content)}*`,
    )
    .replace(
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_, content: string) => `- ${normalizeMarkdownContent(stripResidualHtml(content))}\n`,
    )
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n");

  for (let level = 1; level <= 6; level += 1) {
    const pattern = new RegExp(
      `<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`,
      "gi",
    );
    output = output.replace(pattern, (_, content: string) => {
      const text = stripResidualHtml(content).replace(/\s+/g, " ").trim();
      return `${"#".repeat(level)} ${text}\n\n`;
    });
  }

  output = output.replace(
    /<(p|div|section|article|blockquote)[^>]*>([\s\S]*?)<\/(p|div|section|article|blockquote)>/gi,
    (_, __: string, content: string) => `${stripResidualHtml(content).trim()}\n\n`,
  );

  output = output.replace(/<\/?[^>]+>/g, "");
  return normalizeMarkdownContent(decodeHtmlEntities(output));
}

function toNotionMarkdown(value: DashboardFieldValue) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = normalizeMarkdownContent(value);
  if (!normalized) {
    return "";
  }

  return looksLikeHtml(normalized)
    ? convertHtmlToMarkdown(normalized)
    : normalized;
}

function toNotionRichText(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return [] as Array<{
      type: "text";
      text: {
        content: string;
      };
    }>;
  }

  const chunks: Array<{
    type: "text";
    text: {
      content: string;
    };
  }> = [];

  for (let index = 0; index < normalized.length; index += NOTION_RICH_TEXT_CHUNK_SIZE) {
    chunks.push({
      type: "text",
      text: {
        content: normalized.slice(index, index + NOTION_RICH_TEXT_CHUNK_SIZE),
      },
    });
  }

  return chunks;
}

function normalizeScalarString(value: DashboardFieldValue) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]).trim() : "";
  }

  return "";
}

function normalizeStringArray(value: DashboardFieldValue) {
  if (!Array.isArray(value)) {
    const scalar = normalizeScalarString(value);
    return scalar ? [scalar] : [];
  }

  return value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

function normalizeBooleanValue(value: DashboardFieldValue) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return Boolean(value);
}

function normalizeNumberValue(value: DashboardFieldValue) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDateValue(value: DashboardFieldValue) {
  const scalar = normalizeScalarString(value);
  return scalar || null;
}

function normalizeUrlValue(value: DashboardFieldValue) {
  const scalar = normalizeScalarString(value);
  if (!scalar) {
    return null;
  }

  try {
    return new URL(scalar).toString();
  } catch {
    return null;
  }
}

function guessExternalFileName(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.split("/").filter(Boolean).pop();
    const decoded = pathname ? decodeURIComponent(pathname) : "";
    return decoded || parsed.hostname || "Attachment";
  } catch {
    return "Attachment";
  }
}

function buildNotionPropertyUpdate(
  property: NotionDataSourceProperty,
  value: DashboardFieldValue,
): NotionPropertyUpdate | null {
  switch (property.type) {
    case "title": {
      const text = normalizeScalarString(value);
      return {
        payload: {
          title: toNotionRichText(text),
        },
        comparisonValue: text,
      };
    }
    case "rich_text": {
      const text = normalizeScalarString(value);
      return {
        payload: {
          rich_text: toNotionRichText(text),
        },
        comparisonValue: text,
      };
    }
    case "status": {
      const text = normalizeScalarString(value);
      return {
        payload: {
          status: text ? { name: text } : null,
        },
        comparisonValue: text || null,
      };
    }
    case "select": {
      const text = normalizeScalarString(value);
      return {
        payload: {
          select: text ? { name: text } : null,
        },
        comparisonValue: text || null,
      };
    }
    case "multi_select": {
      const values = normalizeStringArray(value);
      return {
        payload: {
          multi_select: values.map((entry) => ({ name: entry })),
        },
        comparisonValue: values,
      };
    }
    case "number": {
      const numberValue = normalizeNumberValue(value);
      return {
        payload: {
          number: numberValue,
        },
        comparisonValue: numberValue,
      };
    }
    case "checkbox": {
      const checkboxValue = normalizeBooleanValue(value);
      return {
        payload: {
          checkbox: checkboxValue,
        },
        comparisonValue: checkboxValue,
      };
    }
    case "date": {
      const dateValue = normalizeDateValue(value);
      return {
        payload: {
          date: dateValue ? { start: dateValue } : null,
        },
        comparisonValue: dateValue,
      };
    }
    case "url":
    case "email":
    case "phone_number": {
      const text = normalizeScalarString(value);
      return {
        payload: {
          [property.type]: text || null,
        },
        comparisonValue: text || null,
      };
    }
    case "files": {
      const fileUrl = normalizeUrlValue(value);
      return {
        payload: {
          files: fileUrl
            ? [
                {
                  type: "external",
                  name: guessExternalFileName(fileUrl),
                  external: {
                    url: fileUrl,
                  },
                },
              ]
            : [],
        },
        comparisonValue: fileUrl,
      };
    }
    default:
      return null;
  }
}

function areValuesEqual(left: DashboardFieldValue, right: DashboardFieldValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasDashboardValue(value: DashboardFieldValue) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function getTitlePropertyName(dataSource: NotionDataSource) {
  const titleProperty = Object.entries(dataSource.properties).find(
    ([, property]) => property.type === "title",
  );

  if (!titleProperty) {
    throw new AppError("The Notion data source does not expose a title property.", 400);
  }

  return titleProperty[0];
}

function getMappedDataSourceProperty(
  properties: Record<string, NotionDataSourceProperty>,
  field: DashboardFieldDefinition,
  logicalKey: keyof typeof LOGICAL_FIELD_PATTERNS | undefined,
) {
  const fieldMap = getNotionFieldMap();
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

function getMappedAuditDataSourceProperty(
  properties: Record<string, NotionDataSourceProperty>,
  key: keyof typeof FRAMER_AUDIT_PROPERTY_PATTERNS,
) {
  const fieldMap = getNotionFieldMap();
  const configuredName = fieldMap[key];

  if (configuredName) {
    return getPropertyByName(properties, configuredName);
  }

  return getPropertyByPatterns(properties, FRAMER_AUDIT_PROPERTY_PATTERNS[key]);
}

function buildNotionPropertiesForPost(
  metadata: BlogCollectionMetadata,
  dataSource: NotionDataSource,
  post: BlogPostRecord,
  existingPage?: NotionPage,
) {
  const env = getServerEnv();
  const properties: Record<string, NotionPropertyPayload> = {};
  const usedPropertyNames = new Set<string>();

  const titlePropertyName = getTitlePropertyName(dataSource);
  const titleUpdate = buildNotionPropertyUpdate(
    dataSource.properties[titlePropertyName],
    post.title,
  );
  if (titleUpdate) {
    const currentTitle = existingPage?.properties[titlePropertyName];
    if (!currentTitle || !areValuesEqual(extractPropertyValue(currentTitle), titleUpdate.comparisonValue)) {
      properties[titlePropertyName] = titleUpdate.payload;
    }
    usedPropertyNames.add(titlePropertyName);
  }

  const slugProperty = getPropertyByName(
    dataSource.properties,
    env.NOTION_SLUG_PROPERTY_NAME,
  );
  if (slugProperty) {
    const [propertyName, property] = slugProperty;
    const slugUpdate = buildNotionPropertyUpdate(property, post.slug);
    if (slugUpdate) {
      const currentValue = existingPage?.properties[propertyName];
      if (
        !currentValue ||
        !areValuesEqual(extractPropertyValue(currentValue), slugUpdate.comparisonValue)
      ) {
        properties[propertyName] = slugUpdate.payload;
      }
      usedPropertyNames.add(propertyName);
    }
  }

  const framerItemIdProperty = getPropertyByName(
    dataSource.properties,
    env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME,
  );
  if (!framerItemIdProperty) {
    throw new AppError(
      `The Notion property "${env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME}" was not found in the configured data source.`,
      400,
    );
  }

  const [framerItemIdPropertyName, framerItemIdPropertyDef] = framerItemIdProperty;
  const framerItemIdUpdate = buildNotionPropertyUpdate(framerItemIdPropertyDef, post.id);
  if (!framerItemIdUpdate) {
    throw new AppError(
      `The Notion property "${env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME}" must be writable to store Framer item IDs.`,
      400,
    );
  }

  const currentFramerItemId = existingPage?.properties[framerItemIdPropertyName];
  if (
    !currentFramerItemId ||
    !areValuesEqual(
      extractPropertyValue(currentFramerItemId),
      framerItemIdUpdate.comparisonValue,
    )
  ) {
    properties[framerItemIdPropertyName] = framerItemIdUpdate.payload;
  }
  usedPropertyNames.add(framerItemIdPropertyName);

  const responseProperty = getPropertyByName(
    dataSource.properties,
    env.NOTION_RESPONSE_PROPERTY_NAME,
  );
  if (responseProperty) {
    usedPropertyNames.add(responseProperty[0]);
  }

  const statusProperty = getPropertyByName(
    dataSource.properties,
    env.NOTION_STATUS_PROPERTY_NAME,
  );
  if (statusProperty) {
    const [propertyName, property] = statusProperty;
    const currentStatusValue = existingPage?.properties[propertyName]
      ? extractPropertyValue(existingPage.properties[propertyName])
      : null;

    if (!hasDashboardValue(currentStatusValue)) {
      const desiredStatusValue =
        property.type === "checkbox"
          ? !post.draft
          : post.draft
            ? null
            : env.NOTION_APPROVED_STATUS_VALUE;
      const statusUpdate = buildNotionPropertyUpdate(property, desiredStatusValue);
      if (statusUpdate) {
        properties[propertyName] = statusUpdate.payload;
      }
    }
    usedPropertyNames.add(propertyName);
  }

  for (const [key, value] of [
    ["createdAt", post.createdAt],
    ["lastUpdated", post.lastUpdated],
    ["lastUpdatedBy", post.lastUpdatedBy],
  ] as const) {
    if (!hasDashboardValue(value)) {
      continue;
    }

    const propertyEntry = getMappedAuditDataSourceProperty(dataSource.properties, key);
    if (!propertyEntry) {
      continue;
    }

    const [propertyName, property] = propertyEntry;
    if (usedPropertyNames.has(propertyName)) {
      continue;
    }

    const update = buildNotionPropertyUpdate(property, value);
    if (!update) {
      continue;
    }

    const currentValue = existingPage?.properties[propertyName];
    if (
      !currentValue ||
      !areValuesEqual(extractPropertyValue(currentValue), update.comparisonValue)
    ) {
      properties[propertyName] = update.payload;
    }

    usedPropertyNames.add(propertyName);
  }

  for (const field of metadata.fields) {
    if (!field.supported || field.logicalKey === "body" || field.logicalKey === "title") {
      continue;
    }

    const propertyEntry = getMappedDataSourceProperty(
      dataSource.properties,
      field,
      field.logicalKey as keyof typeof LOGICAL_FIELD_PATTERNS | undefined,
    );
    if (!propertyEntry) {
      continue;
    }

    const [propertyName, property] = propertyEntry;
    if (usedPropertyNames.has(propertyName)) {
      continue;
    }

    const update = buildNotionPropertyUpdate(property, post.fieldValues[field.id] ?? null);
    if (!update) {
      continue;
    }

    const currentValue = existingPage?.properties[propertyName];
    if (
      !currentValue ||
      !areValuesEqual(extractPropertyValue(currentValue), update.comparisonValue)
    ) {
      properties[propertyName] = update.payload;
    }

    usedPropertyNames.add(propertyName);
  }

  return properties;
}

function getPostBodyMarkdown(
  metadata: BlogCollectionMetadata,
  post: BlogPostRecord,
) {
  const bodyFieldId = metadata.logicalFields.body;
  return bodyFieldId ? toNotionMarkdown(post.fieldValues[bodyFieldId] ?? null) : "";
}

function indexPagesByBridgeIdentity(pages: NotionPage[]) {
  const byFramerItemId = new Map<string, NotionPage>();
  const bySlug = new Map<string, NotionPage>();
  const bridgeConfig = getNotionBridgeConfig();

  for (const page of pages) {
    const identifiers = getBridgePageIdentifiers(page, bridgeConfig);
    if (identifiers.framerItemId && !byFramerItemId.has(identifiers.framerItemId)) {
      byFramerItemId.set(identifiers.framerItemId, page);
    }
    if (identifiers.slug && !bySlug.has(normalizeLabel(identifiers.slug))) {
      bySlug.set(normalizeLabel(identifiers.slug), page);
    }
  }

  return {
    byFramerItemId,
    bySlug,
  };
}

function rememberBridgeIdentity(
  index: ReturnType<typeof indexPagesByBridgeIdentity>,
  page: NotionPage,
  post: BlogPostRecord,
) {
  index.byFramerItemId.set(post.id, page);
  index.bySlug.set(normalizeLabel(post.slug), page);
}

function matchPageForFramerPost(
  index: ReturnType<typeof indexPagesByBridgeIdentity>,
  post: BlogPostRecord,
) {
  const pageById = index.byFramerItemId.get(post.id);
  if (pageById) {
    return {
      page: pageById,
      matchedBy: "framerItemId" as const,
    };
  }

  const pageBySlug = index.bySlug.get(normalizeLabel(post.slug));
  if (pageBySlug) {
    return {
      page: pageBySlug,
      matchedBy: "slug" as const,
    };
  }

  return null;
}

async function createPageFromFramerPost(
  dataSource: NotionDataSource & { _isLegacyDatabase?: boolean },
  properties: Record<string, NotionPropertyPayload>,
  markdownBody: string,
) {
  const parentPayload = (dataSource as { _isLegacyDatabase?: boolean })._isLegacyDatabase
    ? { type: "database_id", database_id: dataSource.id }
    : { type: "data_source_id", data_source_id: dataSource.id };

  return notionRequest<NotionPage>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: parentPayload,
      properties,
      ...(markdownBody
        ? {
            markdown: markdownBody,
          }
        : {}),
    }),
  });
}

async function updateNotionPageProperties(
  pageId: string,
  properties: Record<string, NotionPropertyPayload>,
) {
  if (Object.keys(properties).length === 0) {
    return;
  }

  await notionRequest(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties,
    }),
  });
}

async function replacePageMarkdown(pageId: string, markdownBody: string) {
  await notionRequest(
    `/pages/${pageId}/markdown`,
    {
      method: "PATCH",
      body: JSON.stringify({
        type: "replace_content",
        replace_content: {
          new_str: markdownBody,
          allow_deleting_content: true,
        },
      }),
    },
    {
      notionVersion: NOTION_MARKDOWN_WRITE_VERSION,
    },
  );
}

export async function importFramerPostsToNotion(options?: { postId?: string }) {
  assertNotionBridgeConfigured();

  const postId = options?.postId?.trim();
  const [{ dataSource, pages }, { metadata, posts }] = await Promise.all([
    queryAllPages(),
    getDashboardOverview(),
  ]);
  const pageIndex = indexPagesByBridgeIdentity(pages);
  const targetPosts = postId ? posts.filter((post) => post.id === postId) : posts;

  if (postId && targetPosts.length === 0) {
    throw new AppError("Blog post not found.", 404);
  }

  const results: FramerImportResult[] = [];

  for (const post of targetPosts) {
    const match = matchPageForFramerPost(pageIndex, post);
    const markdownBody = getPostBodyMarkdown(metadata, post);

    if (!match) {
      const created = await createPageFromFramerPost(
        dataSource,
        buildNotionPropertiesForPost(metadata, dataSource, post),
        markdownBody,
      );
      rememberBridgeIdentity(pageIndex, created, post);
      results.push({
        framerItemId: post.id,
        notionPageId: created.id,
        notionPageUrl: created.url ?? null,
        title: post.title,
        slug: post.slug,
        action: "created",
        matchedBy: "none",
      });
      continue;
    }

    const currentMarkdown = normalizeMarkdownContent(await getPageMarkdown(match.page.id));
    const desiredMarkdown = normalizeMarkdownContent(markdownBody);
    const properties = buildNotionPropertiesForPost(
      metadata,
      dataSource,
      post,
      match.page,
    );
    const markdownChanged = currentMarkdown !== desiredMarkdown;
    const propertiesChanged = Object.keys(properties).length > 0;

    if (!propertiesChanged && !markdownChanged) {
      rememberBridgeIdentity(pageIndex, match.page, post);
      results.push({
        framerItemId: post.id,
        notionPageId: match.page.id,
        notionPageUrl: match.page.url ?? null,
        title: post.title,
        slug: post.slug,
        action: "unchanged",
        matchedBy: match.matchedBy,
      });
      continue;
    }

    await updateNotionPageProperties(match.page.id, properties);
    if (markdownChanged) {
      await replacePageMarkdown(match.page.id, desiredMarkdown);
    }

    rememberBridgeIdentity(pageIndex, match.page, post);
    results.push({
      framerItemId: post.id,
      notionPageId: match.page.id,
      notionPageUrl: match.page.url ?? null,
      title: post.title,
      slug: post.slug,
      action: "updated",
      matchedBy: match.matchedBy,
    });
  }

  return {
    mode: postId ? "post" : "allFramer",
    importedPosts: results.length,
    createdPages: results.filter((result) => result.action === "created").length,
    updatedPages: results.filter((result) => result.action === "updated").length,
    unchangedPages: results.filter((result) => result.action === "unchanged").length,
    results,
  };
}

export async function syncApprovedNotionPages(options?: { pageId?: string }) {
  assertNotionBridgeConfigured();

  const pageId = options?.pageId?.trim();
  const bridgeConfig = getNotionBridgeConfig();

  if (pageId) {
    const page = await getPage(pageId);
    const env = getServerEnv();
    const statusPropertyName = env.NOTION_STATUS_PROPERTY_NAME;
    const approvedStatusValue = env.NOTION_APPROVED_STATUS_VALUE;
    const propertyNames = Object.keys(page.properties);
    const statusValue = getStatusValue(page.properties, bridgeConfig);
    const active = isActivePage(page);
    const approved = isApprovedPage(page, bridgeConfig);

    logEvent("info", "notion.sync.page.diagnosis", {
      pageId,
      active,
      approved,
      archived: page.archived ?? false,
      inTrash: page.in_trash ?? false,
      configuredStatusProperty: statusPropertyName,
      configuredApprovedValue: approvedStatusValue,
      actualStatusValue: statusValue,
      statusPropertyFound: statusPropertyName in page.properties,
      allPropertyNames: propertyNames,
    });

    if (!approved) {
      logEvent("info", "notion.sync.page.draftingUnapproved", {
        pageId,
        actualStatusValue: statusValue,
      });
    }

    try {
      const result = await syncNotionPageToFramer(
        await getBlogMetadata(),
        page,
        active ? await getPageMarkdown(page.id) : "",
        bridgeConfig,
        {
          backfillFramerItemId: updateFramerItemIdOnPage,
          removeBridgePosts,
          syncBridgePosts,
        },
      );
      const pageResult = result.results[0];

      if (pageResult) {
        await recordResponseOnPage(
          page,
          pageResult.action === "deleted"
            ? buildRemovedResponseMessage(pageResult)
            : buildSyncedResponseMessage(pageResult, {
                draftedBecauseUnapproved: active && !approved,
              }),
        );
      } else if (!active) {
        await recordResponseOnPage(
          page,
          buildSkippedResponseMessage("The page is archived or trashed."),
        );
      }

      return result;
    } catch (error) {
      await recordResponseOnPage(page, buildFailedResponseMessage(error));
      throw error;
    }
  }

  const approvedPages = await queryApprovedPages();

  logEvent("info", "notion.sync.allApproved.diagnosis", {
    approvedPageCount: approvedPages.length,
    approvedPageIds: approvedPages.map((p) => p.id),
  });

  const { candidates, pageMap } = await buildSyncCandidates(approvedPages);
  const syncResult = await syncBridgePostsFromRaw(
    candidates,
    "notion-bridge",
    (metadata, candidate) =>
      buildBridgeSyncInput(metadata, candidate.page, candidate.markdownBody, bridgeConfig),
    true,
  );
  const backfillResults = await mapWithConcurrency(
    syncResult.results,
    NOTION_MARKDOWN_CONCURRENCY,
    async (result) => {
      const page = pageMap.get(result.externalId);
      if (!page) {
        return 0;
      }

      const backfilled = await updateFramerItemIdOnPage(page, result.framerItemId);
      await recordResponseOnPage(page, buildSyncedResponseMessage(result));
      return backfilled ? 1 : 0;
    },
  );

  return {
    mode: "allApproved",
    syncedPages: syncResult.results.length,
    removedPages: 0,
    skippedPages: [],
    backfilledFramerItemIds: backfillResults.reduce<number>((sum, value) => sum + value, 0),
    results: syncResult.results,
    publish: syncResult.publish,
  };
}

export { extractPageIdFromPayload };
