import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  BridgeRemovalInput,
  BridgeSyncInput,
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
import {
  getDashboardOverview,
  removeBridgePosts,
  syncBridgePostsFromRaw,
} from "@/lib/framer";
import { extractPageIdFromPayload } from "@/lib/notion-payload";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2025-09-03";
const NOTION_MARKDOWN_WRITE_VERSION = "2026-03-11";
const NOTION_MARKDOWN_CONCURRENCY = 5;
const NOTION_RICH_TEXT_CHUNK_SIZE = 2_000;

const LOGICAL_FIELD_PATTERNS = {
  title: ["title", "headline", "name", "post title"],
  body: ["body", "content", "post body", "article body", "copy", "markdown"],
  author: ["author", "writer", "byline"],
  date: ["date", "publish date", "published date", "published", "publication date"],
  slug: ["slug", "url slug", "permalink"],
} as const;

type NotionPropertyType =
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

type NotionRichText = {
  plain_text?: string;
  text?: {
    content?: string;
  };
};

type NotionProperty = {
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

type NotionPage = {
  object: "page";
  id: string;
  archived?: boolean;
  in_trash?: boolean;
  last_edited_time?: string;
  url?: string;
  properties: Record<string, NotionProperty>;
};

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

type RawSyncCandidate = {
  page: NotionPage;
  markdownBody: string;
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
    fieldMap: getNotionFieldMap(),
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

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string) {
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

function extractPropertyValue(property: NotionProperty): DashboardFieldValue {
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

function extractStablePropertyValue(property: NotionProperty): DashboardFieldValue {
  if (property.type === "files") {
    return extractStableFileValue(property);
  }

  return extractPropertyValue(property);
}

function buildSourceVersion(page: NotionPage, markdownBody: string) {
  const ignoredPropertyName = normalizeLabel(
    getServerEnv().NOTION_FRAMER_ITEM_ID_PROPERTY_NAME,
  );
  const properties = Object.entries(page.properties)
    .filter(([propertyName]) => normalizeLabel(propertyName) !== ignoredPropertyName)
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

function getPropertyByName<T extends { type: string }>(
  properties: Record<string, T>,
  name: string,
) {
  const normalizedName = normalizeLabel(name);
  return Object.entries(properties).find(
    ([propertyName]) => normalizeLabel(propertyName) === normalizedName,
  );
}

function getPropertyByPatterns<T extends { type: string }>(
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
  return notionRequest<NotionDataSource>(`/data_sources/${env.NOTION_DATA_SOURCE_ID}`);
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

function isActivePage(page: NotionPage) {
  return !page.archived && !page.in_trash;
}

async function queryDataSourcePages(
  dataSource: NotionDataSource,
  filter?: Record<string, unknown>,
) {
  const pages: NotionPage[] = [];
  let nextCursor: string | null = null;

  do {
    const payload: NotionQueryResponse = await notionRequest<NotionQueryResponse>(
      `/data_sources/${dataSource.id}/query`,
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

function getTitleValue(properties: Record<string, NotionProperty>) {
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

function getStatusValue(properties: Record<string, NotionProperty>) {
  const env = getServerEnv();
  const statusProperty = properties[env.NOTION_STATUS_PROPERTY_NAME];
  return statusProperty ? extractPropertyValue(statusProperty) : null;
}

function isApprovedPage(page: NotionPage) {
  const env = getServerEnv();
  const statusValue = getStatusValue(page.properties);

  if (typeof statusValue === "boolean") {
    return statusValue === (env.NOTION_APPROVED_STATUS_VALUE.toLowerCase() === "true");
  }

  return normalizeLabel(String(statusValue ?? "")) ===
    normalizeLabel(env.NOTION_APPROVED_STATUS_VALUE);
}

function buildFieldValues(
  metadata: BlogCollectionMetadata,
  properties: Record<string, NotionProperty>,
  markdownBody: string,
) {
  const fieldValues: Record<string, DashboardFieldValue> = {};

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
    );
    if (!propertyEntry) {
      continue;
    }

    const extractedValue = extractPropertyValue(propertyEntry[1]);
    if (field.type === "boolean" && extractedValue === null) {
      continue;
    }

    fieldValues[field.id] = coerceValueForField(field, extractedValue);
  }

  return fieldValues;
}

function buildBridgeSyncInput(
  metadata: BlogCollectionMetadata,
  page: NotionPage,
  markdownBody: string,
): BridgeSyncInput {
  const title = getTitleValue(page.properties);
  const { framerItemId, slug } = getBridgePageIdentifiers(page, title);
  if (!slug) {
    throw new AppError(
      `The Notion page "${title}" could not produce a valid slug.`,
      400,
    );
  }

  return {
    externalId: page.id,
    framerItemId,
    sourceVersion: buildSourceVersion(page, markdownBody),
    slug,
    draft: false,
    fieldValues: buildFieldValues(metadata, page.properties, markdownBody),
  };
}

function getOptionalTitleValue(properties: Record<string, NotionProperty>) {
  try {
    return getTitleValue(properties);
  } catch {
    return null;
  }
}

function getBridgePageIdentifiers(
  page: NotionPage,
  fallbackTitle = getOptionalTitleValue(page.properties),
): {
  framerItemId: string | null;
  slug: string | null;
} {
  const env = getServerEnv();
  const slugProperty =
    getPropertyByName(page.properties, env.NOTION_SLUG_PROPERTY_NAME) ??
    getPropertyByPatterns(page.properties, LOGICAL_FIELD_PATTERNS.slug);
  const framerItemIdProperty = getPropertyByName(
    page.properties,
    env.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME,
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

function buildBridgeRemovalInput(page: NotionPage): BridgeRemovalInput {
  const { framerItemId, slug } = getBridgePageIdentifiers(page);

  return {
    externalId: page.id,
    framerItemId,
    slug,
  };
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

  for (const page of pages) {
    const identifiers = getBridgePageIdentifiers(page);
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
  dataSource: NotionDataSource,
  properties: Record<string, NotionPropertyPayload>,
  markdownBody: string,
) {
  return notionRequest<NotionPage>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: {
        type: "data_source_id",
        data_source_id: dataSource.id,
      },
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

  if (pageId) {
    const page = await getPage(pageId);
    if (!isActivePage(page) || !isApprovedPage(page)) {
      const cleanupResult = await removeBridgePosts(
        [buildBridgeRemovalInput(page)],
        "notion-bridge",
      );

      return {
        mode: "page",
        syncedPages: 0,
        removedPages: cleanupResult.results.length,
        skippedPages:
          cleanupResult.results.length > 0
            ? []
            : [
                {
                  pageId,
                  reason: "The requested page is not approved.",
                },
              ],
        backfilledFramerItemIds: 0,
        results: cleanupResult.results,
        publish: cleanupResult.publish,
      };
    }

    const { candidates, pageMap } = await buildSyncCandidates([page]);
    const syncResult = await syncBridgePostsFromRaw(
      candidates,
      "notion-bridge",
      (metadata, candidate) =>
        buildBridgeSyncInput(metadata, candidate.page, candidate.markdownBody),
    );
    let backfilledFramerItemIds = 0;

    for (const result of syncResult.results) {
      const sourcePage = pageMap.get(result.externalId);
      if (!sourcePage) {
        continue;
      }

      if (await updateFramerItemIdOnPage(sourcePage, result.framerItemId)) {
        backfilledFramerItemIds += 1;
      }
    }

    return {
      mode: "page",
      syncedPages: syncResult.results.length,
      removedPages: 0,
      skippedPages: [],
      backfilledFramerItemIds,
      results: syncResult.results,
      publish: syncResult.publish,
    };
  }

  const approvedPages = await queryApprovedPages();
  const { candidates, pageMap } = await buildSyncCandidates(approvedPages);
  const syncResult = await syncBridgePostsFromRaw(
    candidates,
    "notion-bridge",
    (metadata, candidate) =>
      buildBridgeSyncInput(metadata, candidate.page, candidate.markdownBody),
  );
  let backfilledFramerItemIds = 0;

  for (const result of syncResult.results) {
    const page = pageMap.get(result.externalId);
    if (!page) {
      continue;
    }

    if (await updateFramerItemIdOnPage(page, result.framerItemId)) {
      backfilledFramerItemIds += 1;
    }
  }

  return {
    mode: "allApproved",
    syncedPages: syncResult.results.length,
    removedPages: 0,
    skippedPages: [],
    backfilledFramerItemIds,
    results: syncResult.results,
    publish: syncResult.publish,
  };
}

export { extractPageIdFromPayload };
