import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createErrorJsonResponse } from "@/lib/api";
import { requireAIConfig } from "@/lib/ai-config";
import { IMAGE_SYSTEM_PROMPT, buildImagePrompt } from "@/lib/ai-image-prompt";
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

    const { prompt, context } = parsed.data;

    logEvent("info", "ai.image_gen.requested", {
      promptLength: prompt.length,
      hasContext: Boolean(context),
      model: config.imageModel,
    });

    const userPrompt = buildImagePrompt(prompt, context);

    const result = await generateText({
      model: config.provider(config.imageModel),
      system: IMAGE_SYSTEM_PROMPT,
      prompt: userPrompt,
      providerOptions: {
        vertex: { generationConfig: { responseModalities: ["IMAGE", "TEXT"] } },
      },
    });

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
