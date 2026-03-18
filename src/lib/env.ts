import { z } from "zod";

import { AppError } from "@/lib/errors";

const rawEnvSchema = z.object({
  FRAMER_API_KEY: z.string().optional(),
  NOTION_API_KEY: z.string().optional(),
  NOTION_WEBHOOK_SECRET: z.string().optional(),
});

export interface ServerEnv {
  FRAMER_API_KEY?: string;
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
  if (process.env.FRAMER_API_KEY?.trim()) {
    return [];
  }

  return [
    {
      path: "FRAMER_API_KEY",
      message: "FRAMER_API_KEY is required for the legacy bridge configuration.",
    },
  ];
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

  const optionalSchemaResult = rawEnvSchema.safeParse(process.env);
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
    FRAMER_API_KEY: normalizeOptionalValue(parsed.FRAMER_API_KEY),
    NOTION_API_KEY: normalizeOptionalValue(parsed.NOTION_API_KEY),
    NOTION_WEBHOOK_SECRET: normalizeOptionalValue(parsed.NOTION_WEBHOOK_SECRET),
  };
  return cachedEnv;
}

export function getLegacyFramerApiKey() {
  const apiKey = getServerEnv().FRAMER_API_KEY;
  if (apiKey) {
    return apiKey;
  }

  throw new AppError(
    "FRAMER_API_KEY is required for the legacy bridge configuration.",
    503,
  );
}

// ---------------------------------------------------------------------------
// AI / Vertex AI environment (optional — dashboard works without these)
// ---------------------------------------------------------------------------

const aiEnvSchema = z.object({
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().optional(),
});

/** Gemini 3.1 Pro — advanced reasoning, text generation */
export const GEMINI_TEXT_MODEL = "gemini-3.1-pro-preview";
/** Nano Banana 2 (Gemini 3.1 Flash Image) — image generation */
export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export interface AIEnv {
  GOOGLE_CLOUD_PROJECT: string;
  GOOGLE_CLOUD_LOCATION: string;
}

let cachedAIEnv: AIEnv | undefined | null = null; // null = not yet resolved

/**
 * Returns diagnostics for AI-related env vars.
 * Empty array means either AI is fully configured or not attempted at all.
 * Issues are only reported when at least one AI var is provided but the
 * required pair is incomplete.
 */
export function getAIEnvIssues(): Array<{ path: string; message: string }> {
  const schemaResult = aiEnvSchema.safeParse(process.env);
  if (!schemaResult.success) {
    return mapIssues(schemaResult.error.issues);
  }

  const project = normalizeOptionalValue(process.env.GOOGLE_CLOUD_PROJECT);
  const location = normalizeOptionalValue(process.env.GOOGLE_CLOUD_LOCATION);

  // If neither is set, AI features are simply not configured — no issues.
  if (!project && !location) {
    return [];
  }

  const issues: Array<{ path: string; message: string }> = [];

  if (!project) {
    issues.push({
      path: "GOOGLE_CLOUD_PROJECT",
      message:
        "GOOGLE_CLOUD_PROJECT is required when GOOGLE_CLOUD_LOCATION is set.",
    });
  }

  if (!location) {
    issues.push({
      path: "GOOGLE_CLOUD_LOCATION",
      message:
        "GOOGLE_CLOUD_LOCATION is required when GOOGLE_CLOUD_PROJECT is set.",
    });
  }

  return issues;
}

/**
 * Returns the validated AI env vars, or `undefined` if AI features are not
 * configured. The dashboard continues to work normally when this returns
 * `undefined`.
 */
export function getAIEnv(): AIEnv | undefined {
  if (cachedAIEnv !== null) {
    return cachedAIEnv;
  }

  const project = normalizeOptionalValue(process.env.GOOGLE_CLOUD_PROJECT);
  const location = normalizeOptionalValue(process.env.GOOGLE_CLOUD_LOCATION);

  if (!project || !location) {
    cachedAIEnv = undefined;
    return undefined;
  }

  cachedAIEnv = {
    GOOGLE_CLOUD_PROJECT: project,
    GOOGLE_CLOUD_LOCATION: location,
  };

  return cachedAIEnv;
}
