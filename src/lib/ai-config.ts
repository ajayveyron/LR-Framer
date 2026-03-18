import { createVertex } from "@ai-sdk/google-vertex";

import { getAIEnv, GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL } from "@/lib/env";
import { AppError } from "@/lib/errors";

export interface AIConfig {
  provider: ReturnType<typeof createVertex>;
  textModel: string;
  imageModel: string;
}

/**
 * Returns an AIConfig if the required Vertex AI env vars are set,
 * or `undefined` when AI features are not configured.
 */
export function getAIConfig(): AIConfig | undefined {
  const env = getAIEnv();
  if (!env) {
    return undefined;
  }

  const provider = createVertex({
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  return {
    provider,
    textModel: GEMINI_TEXT_MODEL,
    imageModel: GEMINI_IMAGE_MODEL,
  };
}

/**
 * Returns an AIConfig or throws a 503 AppError when the required
 * Vertex AI environment variables are missing.
 */
export function requireAIConfig(): AIConfig {
  const config = getAIConfig();
  if (!config) {
    throw new AppError(
      "AI features require GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.",
      503,
    );
  }
  return config;
}
