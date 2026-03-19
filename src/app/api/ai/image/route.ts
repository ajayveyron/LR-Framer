import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createErrorJsonResponse } from "@/lib/api";
import { requireAIConfig } from "@/lib/ai-config";
import { hardenUntrustedTextBlock } from "@/lib/ai-guardrails";
import { buildImagePrompt } from "@/lib/ai-image-prompt";
import { getImageSystemPrompt } from "@/lib/brand";
import { AppError } from "@/lib/errors";
import { logEvent, logError } from "@/lib/logger";

export const runtime = "nodejs";

const requestSchema = z.object({
  prompt: z.string().min(1, "A prompt is required."),
  referenceImageUrl: z.string().optional(),
  context: z
    .object({
      title: z.string().optional(),
      slug: z.string().optional(),
      bodyText: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const startMs = Date.now();

  try {
    const config = requireAIConfig();
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
      );
    }

    const { prompt, referenceImageUrl, context } = parsed.data;

    logEvent("info", "ai.image_gen.requested", {
      promptLength: prompt.length,
      hasContext: Boolean(context),
      hasReferenceImage: Boolean(referenceImageUrl),
      referenceImageUrl: referenceImageUrl ?? null,
      model: config.imageModel,
    });

    // ── USER PROMPT ──
    // Built from what the user typed + CMS context (title, slug, body).
    // See: buildImagePrompt() in src/lib/ai-image-prompt.ts
    const userPrompt = buildImagePrompt(
      hardenUntrustedTextBlock("image prompt", prompt),
      context
        ? {
            ...context,
            title: context.title
              ? hardenUntrustedTextBlock("image title context", context.title)
              : context.title,
            slug: context.slug
              ? hardenUntrustedTextBlock("image slug context", context.slug)
              : context.slug,
            bodyText: context.bodyText
              ? hardenUntrustedTextBlock("image body context", context.bodyText)
              : context.bodyText,
          }
        : context,
    );

    const systemPrompt = await getImageSystemPrompt();

    logEvent("info", "ai.image_gen.prompt_assembled", {
      systemPrompt,
      userPrompt,
      hasReferenceImage: Boolean(referenceImageUrl),
    });

    // ── BUILD MESSAGES ──
    // For generateText with Gemini, we pass the user prompt as a message.
    // If a reference image URL is provided, we include it as an image part
    // so the model can see and use it for generation.
    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image"; image: string }
    > = [{ type: "text", text: userPrompt }];

    if (referenceImageUrl) {
      userContent.push({ type: "image", image: referenceImageUrl });
    }

    // ── GENERATE ──
    // Using generateText (not generateImage) because Gemini image models
    // support system prompts via generateText. Images come back in result.files.
    // We handle retries manually to log each attempt for debugging.
    const MAX_ATTEMPTS = 2;
    let result: Awaited<ReturnType<typeof generateText>> | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        logEvent("info", "ai.image_gen.attempt", {
          attempt,
          maxAttempts: MAX_ATTEMPTS,
        });

        // 120s timeout per attempt — image gen with reference images can take 90s+
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300_000);

        try {
          result = await generateText({
            model: config.provider(config.imageModel),
            system: systemPrompt,
            // ── USER MESSAGE ── the actual request + blog context + optional reference image
            messages: [{ role: "user" as const, content: userContent }],
            providerOptions: {
              // Tell Vertex to return images (not just text)
              vertex: { generationConfig: { responseModalities: ["IMAGE", "TEXT"] } },
            },
            // Disable SDK-level retries — we handle them ourselves for logging
            maxRetries: 0,
            abortSignal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        // Success — break out of retry loop
        break;
      } catch (err) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        logEvent("warn", "ai.image_gen.attempt_failed", {
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          error: errMsg,
          willRetry: attempt < MAX_ATTEMPTS,
        });

        if (attempt >= MAX_ATTEMPTS) break;

        // Brief backoff before retry
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    if (!result) {
      throw lastError ?? new AppError("Image generation failed after retries.", 502);
    }

    const imageFile = result.files?.find((f) =>
      f.mediaType?.startsWith("image/"),
    );

    if (!imageFile) {
      throw new AppError(
        "The model did not return an image. Try a different prompt.",
        502,
      );
    }

    logEvent("info", "ai.image_gen.completed", {
      durationMs: Date.now() - startMs,
      success: true,
    });

    return NextResponse.json({
      imageBase64: imageFile.base64,
      mimeType: imageFile.mediaType ?? "image/png",
    });
  } catch (error) {
    logError("ai.image_gen.failed", error);
    return createErrorJsonResponse(error);
  }
}
