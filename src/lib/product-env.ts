import { z } from "zod";

export interface ProductEnv {
  CLERK_SECRET_KEY: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  NEXT_PUBLIC_CONVEX_URL: string;
  PRODUCT_ENCRYPTION_KEY: string;
}

const productEnvSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_CONVEX_URL: z
    .string()
    .url("NEXT_PUBLIC_CONVEX_URL must be a valid URL"),
  PRODUCT_ENCRYPTION_KEY: z
    .string()
    .min(16, "PRODUCT_ENCRYPTION_KEY must be at least 16 characters"),
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

export function getProductEnv(): ProductEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = productEnvSchema.parse(process.env);
  return cachedEnv;
}
