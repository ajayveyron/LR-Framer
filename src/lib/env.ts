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
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_PRIVATE_KEY_ID: z.string().optional(),
});

/** Gemini 3.1 Flash Lite — fast, cost-efficient text generation */
export const GEMINI_TEXT_MODEL = "gemini-3.1-flash-lite-preview";
/** Nano Banana 2 (Gemini 3.1 Flash Image) — image generation */
export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export interface AIEnv {
  GOOGLE_CLOUD_PROJECT: string;
  GOOGLE_CLOUD_LOCATION: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_PRIVATE_KEY_ID?: string;
}

let cachedAIEnv: AIEnv | undefined | null = null; // null = not yet resolved

function normalizeOptionalPrivateKey(value: string | undefined) {
  const normalized = normalizeOptionalValue(value);
  return normalized ? normalized.replace(/\\n/g, "\n") : undefined;
}

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
  const clientEmail = normalizeOptionalValue(process.env.GOOGLE_CLIENT_EMAIL);
  const privateKey = normalizeOptionalPrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  // If neither is set, AI features are simply not configured — no issues.
  if (!project && !location && !clientEmail && !privateKey) {
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

  if (clientEmail && !privateKey) {
    issues.push({
      path: "GOOGLE_PRIVATE_KEY",
      message:
        "GOOGLE_PRIVATE_KEY is required when GOOGLE_CLIENT_EMAIL is set.",
    });
  }

  if (privateKey && !clientEmail) {
    issues.push({
      path: "GOOGLE_CLIENT_EMAIL",
      message:
        "GOOGLE_CLIENT_EMAIL is required when GOOGLE_PRIVATE_KEY is set.",
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
  const clientEmail = normalizeOptionalValue(process.env.GOOGLE_CLIENT_EMAIL);
  const privateKey = normalizeOptionalPrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  const privateKeyId = normalizeOptionalValue(process.env.GOOGLE_PRIVATE_KEY_ID);

  if (!project || !location) {
    cachedAIEnv = undefined;
    return undefined;
  }

  cachedAIEnv = {
    GOOGLE_CLOUD_PROJECT: project,
    GOOGLE_CLOUD_LOCATION: location,
    GOOGLE_CLIENT_EMAIL: clientEmail,
    GOOGLE_PRIVATE_KEY: privateKey,
    GOOGLE_PRIVATE_KEY_ID: privateKeyId,
  };

  return cachedAIEnv;
}

// ---------------------------------------------------------------------------
// Dodo Payments billing environment (optional — billing degrades gracefully)
// ---------------------------------------------------------------------------

const dodoBillingEnvSchema = z.object({
  DODO_API_KEY: z.string().optional(),
  DODO_WEBHOOK_SECRET: z.string().optional(),
  DODO_STANDARD_PRODUCT_ID: z.string().optional(),
  DODO_BUSINESS_ID: z.string().optional(),
});

export interface DodoBillingEnv {
  DODO_API_KEY: string;
  DODO_WEBHOOK_SECRET: string;
  DODO_STANDARD_PRODUCT_ID: string;
  DODO_BUSINESS_ID: string;
}

let cachedDodoBillingEnv: DodoBillingEnv | undefined | null = null; // null = not yet resolved

/**
 * Returns diagnostics for Dodo billing env vars.
 * Empty array means either billing is fully configured or not attempted at all.
 * Issues are only reported when at least one DODO_ var is provided but the
 * set is incomplete.
 */
export function getDodoBillingEnvIssues(): Array<{ path: string; message: string }> {
  const schemaResult = dodoBillingEnvSchema.safeParse(process.env);
  if (!schemaResult.success) {
    return mapIssues(schemaResult.error.issues);
  }

  const apiKey = normalizeOptionalValue(process.env.DODO_API_KEY);
  const webhookSecret = normalizeOptionalValue(process.env.DODO_WEBHOOK_SECRET);
  const standardProductId = normalizeOptionalValue(process.env.DODO_STANDARD_PRODUCT_ID);
  const businessId = normalizeOptionalValue(process.env.DODO_BUSINESS_ID);

  // If none are set, billing is simply not configured — no issues.
  if (!apiKey && !webhookSecret && !standardProductId && !businessId) {
    return [];
  }

  const issues: Array<{ path: string; message: string }> = [];

  const requiredEntries = [
    ["DODO_API_KEY", apiKey],
    ["DODO_WEBHOOK_SECRET", webhookSecret],
    ["DODO_STANDARD_PRODUCT_ID", standardProductId],
    ["DODO_BUSINESS_ID", businessId],
  ] as const;

  for (const [key, value] of requiredEntries) {
    if (!value) {
      issues.push({
        path: key,
        message: `${key} is required when any DODO_ billing var is set.`,
      });
    }
  }

  return issues;
}

/**
 * Returns the validated Dodo billing env vars, or `undefined` if billing is
 * not configured. The dashboard continues to work normally when this returns
 * `undefined` — billing features degrade gracefully.
 */
export function getDodoBillingEnv(): DodoBillingEnv | undefined {
  if (cachedDodoBillingEnv !== null) {
    return cachedDodoBillingEnv;
  }

  const apiKey = normalizeOptionalValue(process.env.DODO_API_KEY);
  const webhookSecret = normalizeOptionalValue(process.env.DODO_WEBHOOK_SECRET);
  const standardProductId = normalizeOptionalValue(process.env.DODO_STANDARD_PRODUCT_ID);
  const businessId = normalizeOptionalValue(process.env.DODO_BUSINESS_ID);

  if (!apiKey || !webhookSecret || !standardProductId || !businessId) {
    cachedDodoBillingEnv = undefined;
    return undefined;
  }

  cachedDodoBillingEnv = {
    DODO_API_KEY: apiKey,
    DODO_WEBHOOK_SECRET: webhookSecret,
    DODO_STANDARD_PRODUCT_ID: standardProductId,
    DODO_BUSINESS_ID: businessId,
  };

  return cachedDodoBillingEnv;
}

/**
 * Returns the correct Dodo API base URL based on `DODO_TEST_MODE` env var.
 * - Test: https://test.dodopayments.com
 * - Live: https://live.dodopayments.com
 */
export function getDodoApiBase(): string {
  const testMode = normalizeOptionalValue(process.env.DODO_TEST_MODE);
  return testMode === "true" || testMode === "1"
    ? "https://test.dodopayments.com"
    : "https://live.dodopayments.com";
}

// ---------------------------------------------------------------------------
// Resend email environment (optional — emails degrade gracefully)
// ---------------------------------------------------------------------------

export interface ResendEnv {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
}

let cachedResendEnv: ResendEnv | undefined | null = null; // null = not yet resolved

/**
 * Returns diagnostics for Resend env vars.
 * Empty array means either Resend is fully configured or not attempted at all.
 * Issues are only reported when at least one RESEND_ var is provided but the
 * set is incomplete.
 */
export function getResendEnvIssues(): Array<{ path: string; message: string }> {
  const apiKey = normalizeOptionalValue(process.env.RESEND_API_KEY);
  const fromEmail = normalizeOptionalValue(process.env.RESEND_FROM_EMAIL);

  if (!apiKey && !fromEmail) {
    return [];
  }

  const issues: Array<{ path: string; message: string }> = [];

  if (!apiKey) {
    issues.push({
      path: "RESEND_API_KEY",
      message: "RESEND_API_KEY is required when RESEND_FROM_EMAIL is set.",
    });
  }

  if (!fromEmail) {
    issues.push({
      path: "RESEND_FROM_EMAIL",
      message: "RESEND_FROM_EMAIL is required when RESEND_API_KEY is set.",
    });
  }

  return issues;
}

/**
 * Returns the validated Resend env vars, or `undefined` if email is not
 * configured. The dashboard continues to work normally when this returns
 * `undefined` — email features degrade gracefully.
 */
export function getResendEnv(): ResendEnv | undefined {
  if (cachedResendEnv !== null) {
    return cachedResendEnv;
  }

  const apiKey = normalizeOptionalValue(process.env.RESEND_API_KEY);
  const fromEmail = normalizeOptionalValue(process.env.RESEND_FROM_EMAIL);

  if (!apiKey || !fromEmail) {
    cachedResendEnv = undefined;
    return undefined;
  }

  cachedResendEnv = {
    RESEND_API_KEY: apiKey,
    RESEND_FROM_EMAIL: fromEmail,
  };

  return cachedResendEnv;
}
