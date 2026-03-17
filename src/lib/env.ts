import { z } from "zod";

const framerEnvSchema = z.object({
  FRAMER_API_KEY: z.string().min(1, "FRAMER_API_KEY is required"),
});

const notionBridgeEnvSchema = z.object({
  NOTION_API_KEY: z.string().optional(),
  NOTION_WEBHOOK_SECRET: z.string().optional(),
});

const rawEnvSchema = framerEnvSchema.merge(notionBridgeEnvSchema);

export interface ServerEnv {
  FRAMER_API_KEY: string;
  NOTION_API_KEY?: string;
  NOTION_WEBHOOK_SECRET?: string;
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

  const optionalSchemaResult = notionBridgeEnvSchema.safeParse(process.env);
  if (!optionalSchemaResult.success) {
    issues.push(...mapIssues(optionalSchemaResult.error.issues));
  }

  return issues;
}

export function isNotionBridgeConfigured() {
  return getNotionBridgeEnvIssues().length === 0 && Boolean(
    process.env.NOTION_API_KEY?.trim() &&
      process.env.NOTION_WEBHOOK_SECRET?.trim(),
  );
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = rawEnvSchema.parse(process.env);
  cachedEnv = {
    FRAMER_API_KEY: parsed.FRAMER_API_KEY,
    NOTION_API_KEY: normalizeOptionalValue(parsed.NOTION_API_KEY),
    NOTION_WEBHOOK_SECRET: normalizeOptionalValue(parsed.NOTION_WEBHOOK_SECRET),
  };
  return cachedEnv;
}
