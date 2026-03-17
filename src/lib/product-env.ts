import { z } from "zod";

export interface ProductEnv {
  CLERK_SECRET_KEY: string;
  CONVEX_DEPLOY_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  NEXT_PUBLIC_CONVEX_URL: string;
  PRODUCT_ENCRYPTION_KEY: string;
}

const convexUrlSchema = z
  .string()
  .trim()
  .url("NEXT_PUBLIC_CONVEX_URL must be a valid URL");

const productEnvSchema = z
  .object({
    CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
    CONVEX_DEPLOY_KEY: z.string().trim().optional(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
    NEXT_PUBLIC_CONVEX_URL: z.string().trim().optional(),
    PRODUCT_ENCRYPTION_KEY: z
      .string()
      .min(16, "PRODUCT_ENCRYPTION_KEY must be at least 16 characters"),
  })
  .superRefine((env, ctx) => {
    const derivedConvexUrl = deriveConvexUrlFromDeployKey(
      env.CONVEX_DEPLOY_KEY,
    );
    const providedConvexUrl = normalizeOptionalValue(env.NEXT_PUBLIC_CONVEX_URL);

    if (!providedConvexUrl && !derivedConvexUrl) {
      ctx.addIssue({
        code: "custom",
        message:
          "Set NEXT_PUBLIC_CONVEX_URL or provide CONVEX_DEPLOY_KEY for server-side Convex access.",
        path: ["NEXT_PUBLIC_CONVEX_URL"],
      });
      return;
    }

    if (providedConvexUrl) {
      const result = convexUrlSchema.safeParse(providedConvexUrl);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["NEXT_PUBLIC_CONVEX_URL", ...issue.path],
          });
        }
      }
    }
  });

let cachedEnv: ProductEnv | null = null;

function mapIssues(
  issues: Array<{ path: PropertyKey[]; message: string }>,
) {
  return issues.map((issue) => ({
    path: issue.path.join(".") || "env",
    message: issue.message,
  }));
}

export function getProductEnvIssues() {
  const result = productEnvSchema.safeParse(process.env);
  if (result.success) {
    return [];
  }

  return mapIssues(result.error.issues);
}

export function isProductEnvConfigured() {
  return getProductEnvIssues().length === 0;
}

function normalizeOptionalValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function deriveConvexUrlFromDeployKey(deployKey: string | undefined) {
  const trimmed = normalizeOptionalValue(deployKey);
  if (!trimmed) {
    return undefined;
  }

  const deploymentToken = trimmed.split("|", 1)[0];
  const [deploymentType, deploymentName] = deploymentToken.split(":", 2);
  if (
    (deploymentType !== "dev" && deploymentType !== "prod") ||
    !deploymentName
  ) {
    return undefined;
  }

  return `https://${deploymentName}.convex.cloud`;
}

export function getProductEnv(): ProductEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = productEnvSchema.parse(process.env);
  const resolvedConvexUrl =
    deriveConvexUrlFromDeployKey(parsed.CONVEX_DEPLOY_KEY) ??
    normalizeOptionalValue(parsed.NEXT_PUBLIC_CONVEX_URL);

  if (!resolvedConvexUrl) {
    throw new Error(
      "Set NEXT_PUBLIC_CONVEX_URL or CONVEX_DEPLOY_KEY for Convex access.",
    );
  }

  cachedEnv = {
    CLERK_SECRET_KEY: parsed.CLERK_SECRET_KEY,
    CONVEX_DEPLOY_KEY: normalizeOptionalValue(parsed.CONVEX_DEPLOY_KEY),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: parsed.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CONVEX_URL: resolvedConvexUrl,
    PRODUCT_ENCRYPTION_KEY: parsed.PRODUCT_ENCRYPTION_KEY,
  };
  return cachedEnv;
}
