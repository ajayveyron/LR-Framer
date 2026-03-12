import { z } from "zod";

const framerEnvSchema = z.object({
  FRAMER_PROJECT_URL: z.string().min(1, "FRAMER_PROJECT_URL is required"),
  FRAMER_API_KEY: z.string().min(1, "FRAMER_API_KEY is required"),
  FRAMER_COLLECTION_NAME: z.string().min(1).default("Blog"),
});

const notionBridgeEnvSchema = z.object({
  NOTION_API_KEY: z.string().optional(),
  NOTION_DATA_SOURCE_ID: z.string().optional(),
  NOTION_WEBHOOK_SECRET: z.string().optional(),
  NOTION_STATUS_PROPERTY_NAME: z.string().min(1).default("Status"),
  NOTION_APPROVED_STATUS_VALUE: z.string().min(1).default("Approved"),
  NOTION_SLUG_PROPERTY_NAME: z.string().min(1).default("Slug"),
  NOTION_FRAMER_ITEM_ID_PROPERTY_NAME: z.string().min(1).default("Framer Item ID"),
  NOTION_FIELD_MAP: z.string().optional(),
});

const rawEnvSchema = framerEnvSchema.merge(notionBridgeEnvSchema);

export interface ServerEnv {
  FRAMER_PROJECT_URL: string;
  FRAMER_API_KEY: string;
  FRAMER_COLLECTION_NAME: string;
  NOTION_API_KEY?: string;
  NOTION_DATA_SOURCE_ID?: string;
  NOTION_WEBHOOK_SECRET?: string;
  NOTION_STATUS_PROPERTY_NAME: string;
  NOTION_APPROVED_STATUS_VALUE: string;
  NOTION_SLUG_PROPERTY_NAME: string;
  NOTION_FRAMER_ITEM_ID_PROPERTY_NAME: string;
  NOTION_FIELD_MAP?: string;
}

let cachedEnv: ServerEnv | null = null;

function mapIssues(
  issues: Array<{ path: PropertyKey[]; message: string }>,
) {
  return issues.map((issue) => ({
    path: issue.path.join(".") || "env",
    message: issue.message,
  }));
}

function normalizeOptionalValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getNotionFieldMapIssue(rawValue: string | undefined) {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.entries(parsed).some(
        ([key, value]) => key.trim().length === 0 || typeof value !== "string",
      )
    ) {
      throw new Error("invalid");
    }
  } catch {
    return {
      path: "NOTION_FIELD_MAP",
      message: "NOTION_FIELD_MAP must be valid JSON in the form {\"author\":\"Writer\"}.",
    };
  }

  return null;
}

export function getServerEnvIssues() {
  const result = framerEnvSchema.safeParse(process.env);
  if (result.success) {
    return [];
  }

  return mapIssues(result.error.issues);
}

export function getNotionBridgeEnvIssues() {
  const provided = Object.entries(process.env).some(
    ([key, value]) => key.startsWith("NOTION_") && Boolean(value?.trim()),
  );

  if (!provided) {
    return [];
  }

  const issues: Array<{ path: string; message: string }> = [];
  const requiredEntries = [
    ["NOTION_API_KEY", process.env.NOTION_API_KEY],
    ["NOTION_DATA_SOURCE_ID", process.env.NOTION_DATA_SOURCE_ID],
    ["NOTION_WEBHOOK_SECRET", process.env.NOTION_WEBHOOK_SECRET],
  ] as const;

  for (const [key, value] of requiredEntries) {
    if (!value?.trim()) {
      issues.push({
        path: key,
        message: `${key} is required to enable the Notion bridge.`,
      });
    }
  }

  const fieldMapIssue = getNotionFieldMapIssue(process.env.NOTION_FIELD_MAP);
  if (fieldMapIssue) {
    issues.push(fieldMapIssue);
  }

  const optionalSchemaResult = notionBridgeEnvSchema.safeParse(process.env);
  if (!optionalSchemaResult.success) {
    issues.push(...mapIssues(optionalSchemaResult.error.issues));
  }

  return issues;
}

export function isNotionBridgeConfigured() {
  return getNotionBridgeEnvIssues().length === 0 && Boolean(
    process.env.NOTION_API_KEY?.trim() &&
      process.env.NOTION_DATA_SOURCE_ID?.trim() &&
      process.env.NOTION_WEBHOOK_SECRET?.trim(),
  );
}

export function getNotionFieldMap() {
  const raw = normalizeOptionalValue(getServerEnv().NOTION_FIELD_MAP);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = rawEnvSchema.parse(process.env);
  cachedEnv = {
    FRAMER_PROJECT_URL: parsed.FRAMER_PROJECT_URL,
    FRAMER_API_KEY: parsed.FRAMER_API_KEY,
    FRAMER_COLLECTION_NAME: parsed.FRAMER_COLLECTION_NAME,
    NOTION_API_KEY: normalizeOptionalValue(parsed.NOTION_API_KEY),
    NOTION_DATA_SOURCE_ID: normalizeOptionalValue(parsed.NOTION_DATA_SOURCE_ID),
    NOTION_WEBHOOK_SECRET: normalizeOptionalValue(parsed.NOTION_WEBHOOK_SECRET),
    NOTION_STATUS_PROPERTY_NAME: parsed.NOTION_STATUS_PROPERTY_NAME,
    NOTION_APPROVED_STATUS_VALUE: parsed.NOTION_APPROVED_STATUS_VALUE,
    NOTION_SLUG_PROPERTY_NAME: parsed.NOTION_SLUG_PROPERTY_NAME,
    NOTION_FRAMER_ITEM_ID_PROPERTY_NAME: parsed.NOTION_FRAMER_ITEM_ID_PROPERTY_NAME,
    NOTION_FIELD_MAP: normalizeOptionalValue(parsed.NOTION_FIELD_MAP),
  };
  return cachedEnv;
}
