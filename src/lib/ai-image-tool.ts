import { generateText, tool } from "ai";
import { z } from "zod";
import { anyApi } from "convex/server";

import { auth } from "@clerk/nextjs/server";

import { getAIConfig } from "@/lib/ai-config";
import {
  addImageJobTarget,
  createImageJob,
  getImageJob,
  incrementImageJobAppliedTargetCount,
  removeImageJobTarget,
  updateImageJob,
} from "@/lib/ai-image-jobs";
import { fetchProductMutation } from "@/lib/convex";
import { trackTokenUsage, FALLBACK_IMAGE_TOKEN_COST } from "@/lib/billing";
import { getImageSystemPrompt } from "@/lib/brand";
import { uploadBlogAsset } from "@/lib/framer-core";
import { logEvent, logError } from "@/lib/logger";

type RunInFramerContext = <T>(fn: () => Promise<T>) => Promise<T>;

async function applyImageToStagedItemTarget(
  jobId: string,
  target: { stagedItemId: string; fieldId: string },
  imageUrl: string,
) {
  await fetchProductMutation(anyApi.stagedItems.setFieldValue, {
    id: target.stagedItemId,
    fieldId: target.fieldId,
    value: imageUrl,
  });
  removeImageJobTarget(jobId, target);
  incrementImageJobAppliedTargetCount(jobId);
}

async function flushCompletedImageTargets(jobId: string, imageUrl: string) {
  const job = getImageJob(jobId);
  const pendingTargets = [...(job?.pendingTargets ?? [])];
  if (pendingTargets.length === 0) return;

  for (const target of pendingTargets) {
    try {
      await applyImageToStagedItemTarget(jobId, target, imageUrl);
    } catch (error) {
      logError("ai.image_job.target_apply.failed", error, {
        jobId,
        stagedItemId: target.stagedItemId,
        fieldId: target.fieldId,
      });
    }
  }
}

export async function attachImageJobToStagedItem(
  jobId: string,
  target: { stagedItemId: string; fieldId: string },
) {
  const job = addImageJobTarget(jobId, target);
  if (!job) return false;

  if (job.status === "completed" && job.url) {
    try {
      await applyImageToStagedItemTarget(jobId, target, job.url);
      return true;
    } catch (error) {
      logError("ai.image_job.target_apply_immediate.failed", error, {
        jobId,
        stagedItemId: target.stagedItemId,
        fieldId: target.fieldId,
      });
    }
  }

  return true;
}

/**
 * Runs the actual image generation + Framer upload in the background.
 * Updates the in-memory job store as it progresses.
 */
async function runImageGeneration(
  jobId: string,
  prompt: string,
  context: { title?: string; slug?: string } | undefined,
  referenceImageUrl: string | undefined,
  referenceImageUrls: string[] | undefined,
  runInFramerContext: RunInFramerContext | undefined,
) {
  const startMs = Date.now();
  const config = getAIConfig();

  if (!config) {
    updateImageJob(jobId, { status: "failed", error: "AI features are not configured." });
    return;
  }

  try {
    updateImageJob(jobId, { status: "running" });

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image"; image: string }
    > = [{ type: "text", text: prompt }];

    if (context?.title) {
      userContent.push({
        type: "text",
        text: `\nBLOG CONTEXT (for understanding only): Title: ${context.title}`,
      });
    }

    const allRefs: string[] = [];
    if (referenceImageUrls && referenceImageUrls.length > 0) {
      allRefs.push(...referenceImageUrls.slice(0, 3));
    }
    if (referenceImageUrl && !allRefs.includes(referenceImageUrl)) {
      allRefs.push(referenceImageUrl);
    }

    if (allRefs.length > 0) {
      userContent.push({
        type: "text",
        text: `\nCRITICAL STYLE INSTRUCTION: The following ${allRefs.length} image(s) are REFERENCES for the visual aesthetics. You MUST match their shared style, color palette, lighting, composition, and textures in your generated image.`,
      });
      for (const url of allRefs) {
        userContent.push({ type: "image", image: url });
      }
    }

    const systemPrompt = await getImageSystemPrompt();
    const MAX_ATTEMPTS = 2;
    let result: Awaited<ReturnType<typeof generateText>> | undefined;
    let imageFile:
      | NonNullable<Awaited<ReturnType<typeof generateText>>["files"]>[number]
      | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300_000);

      try {
        logEvent("info", "ai.tool.generate_image.attempt", {
          jobId,
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          referenceImageCount: allRefs.length,
        });

        result = await generateText({
          model: config.provider(config.imageModel),
          system: systemPrompt,
          messages: [{ role: "user" as const, content: userContent }],
          providerOptions: {
            vertex: {
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
            },
          },
          maxRetries: 0,
          abortSignal: controller.signal,
        });

        imageFile = result.files?.find((f) => f.mediaType?.startsWith("image/"));

        if (!imageFile) {
          throw new Error("The model did not return an image.");
        }

        break;
      } catch (error) {
        lastError = error;
        logEvent("warn", "ai.tool.generate_image.attempt_failed", {
          jobId,
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          error: error instanceof Error ? error.message : String(error),
          willRetry: attempt < MAX_ATTEMPTS,
        });

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!result || !imageFile) {
      const message =
        lastError instanceof Error
          ? lastError.message
          : "The model did not return an image. Try a different prompt.";
      updateImageJob(jobId, {
        status: "failed",
        error: message,
      });
      return;
    }

    const base64 = imageFile.base64;
    const mimeType = imageFile.mediaType ?? "image/png";
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const buffer = Buffer.from(base64, "base64");
    const file = new File([buffer], `ai-generated.${ext}`, { type: mimeType });
    const upload = runInFramerContext
      ? () => runInFramerContext(() => uploadBlogAsset("image", file))
      : () => uploadBlogAsset("image", file);
    const asset = await upload();

    updateImageJob(jobId, {
      status: "completed",
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl ?? undefined,
      mimeType,
    });
    await flushCompletedImageTargets(jobId, asset.url);

    logEvent("info", "ai.tool.generate_image.completed", {
      jobId,
      durationMs: Date.now() - startMs,
      assetUrl: asset.url,
      prompt,
      referenceImageCount: allRefs.length,
      mimeType,
      imageSizeBytes: buffer.length,
    });

    // Track token usage
    try {
      const { orgId, userId } = await auth();
      if (orgId && userId) {
        const promptTokens = result.usage?.inputTokens ?? 0;
        const completionTokens = result.usage?.outputTokens ?? 0;
        const hasUsage = promptTokens > 0 || completionTokens > 0;
        const totalTokens = hasUsage
          ? promptTokens + completionTokens
          : FALLBACK_IMAGE_TOKEN_COST;

        await trackTokenUsage({
          organizationId: orgId,
          userId,
          featureType: "image_tool",
          promptTokens: hasUsage ? promptTokens : FALLBACK_IMAGE_TOKEN_COST,
          completionTokens: hasUsage ? completionTokens : 0,
          totalTokens,
          model: config.imageModel,
        });
      }
    } catch {
      // Auth context may not be available — don't block
    }
  } catch (error) {
    logError("ai.tool.generate_image.failed", error);
    const msg = error instanceof Error ? error.message : String(error);
    updateImageJob(jobId, { status: "failed", error: msg });
  }
}

/**
 * AI tool that kicks off image generation in the background and returns immediately.
 * The frontend polls `/api/ai/image/generate-async/[jobId]` for completion.
 */
function buildGenerateAndUploadImageTool(runInFramerContext?: RunInFramerContext) {
  return tool({
    description:
      "Generate an image from a text prompt using AI, then upload it to Framer as an asset. " +
      "This tool returns IMMEDIATELY with a jobId while the image generates in the background. " +
      "The user will see a live progress indicator and the image will appear automatically when ready. " +
      "You do NOT need to wait for the image — continue with your next task (writing content, proposing CMS actions, etc.). " +
      "When you need to use the image in propose_cms_action, put __image_job__:{jobId} into the image field value. " +
      "The system will replace that placeholder with the uploaded asset automatically once the job finishes. " +
      "Accepts referenceImageUrls (array of up to 3 sibling item image URLs) to match the collection's visual style, " +
      "or referenceImageUrl (single URL) for a user-uploaded reference.",
    inputSchema: z.object({
      prompt: z.string().describe("Text description of the image to generate"),
      context: z
        .object({
          title: z.string().optional().describe("Blog post title for context"),
          slug: z.string().optional().describe("Blog post slug for context"),
        })
        .optional()
        .describe("Optional CMS context to help guide the image style"),
      referenceImageUrl: z
        .string()
        .optional()
        .describe(
          "URL of a single reference image (e.g. user-uploaded attachment). For collection style references, prefer referenceImageUrls.",
        ),
      referenceImageUrls: z
        .array(z.string())
        .optional()
        .describe(
          "URLs of up to 3 reference images from sibling collection items to guide the visual style. The model will analyze all of them to match the collection's aesthetic.",
        ),
    }),
    execute: async ({ prompt, context, referenceImageUrl, referenceImageUrls }) => {
      const config = getAIConfig();

      if (!config) {
        return { success: false, error: "AI features are not configured." };
      }

      const jobId = crypto.randomUUID();

      logEvent("info", "ai.tool.generate_image.dispatched", {
        jobId,
        prompt,
        promptLength: prompt.length,
        hasContext: Boolean(context),
        contextTitle: context?.title ?? null,
        contextSlug: context?.slug ?? null,
        hasReferenceImage: Boolean(referenceImageUrl),
        referenceImageUrl: referenceImageUrl ?? null,
        referenceImageUrls: referenceImageUrls ?? [],
        referenceImageCount: (referenceImageUrls?.length ?? 0) + (referenceImageUrl ? 1 : 0),
      });

      // Create the job and fire off generation — don't await
      createImageJob(jobId, prompt);
      void runImageGeneration(
        jobId,
        prompt,
        context,
        referenceImageUrl,
        referenceImageUrls,
        runInFramerContext,
      );

      return {
        success: true,
        async: true,
        jobId,
        prompt,
        message:
          "Image generation started in the background. The user will see it appear automatically. " +
          "Continue with your next task — do NOT wait for this to complete.",
      };
    },
  });
}

export function createScopedGenerateAndUploadImageTool(
  runInFramerContext: RunInFramerContext,
) {
  return buildGenerateAndUploadImageTool(runInFramerContext);
}

export const generateAndUploadImage = buildGenerateAndUploadImageTool();
