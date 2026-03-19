import { generateText, tool } from "ai";
import { z } from "zod";

import { auth } from "@clerk/nextjs/server";

import { getAIConfig } from "@/lib/ai-config";
import { trackTokenUsage, FALLBACK_IMAGE_TOKEN_COST } from "@/lib/billing";
import { getImageSystemPrompt } from "@/lib/brand";
import { uploadBlogAsset } from "@/lib/framer-core";
import { logEvent, logError } from "@/lib/logger";

type RunInFramerContext = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * AI tool that generates an image via Gemini and uploads it to Framer as an asset.
 * Returns the Framer asset URL so the agent can use it to set image fields on CMS items.
 */
function buildGenerateAndUploadImageTool(runInFramerContext?: RunInFramerContext) {
  return tool({
    description:
      "Generate an image from a text prompt using AI, then upload it to Framer as an asset. " +
      "Returns the uploaded image URL which can be used to set image fields on CMS items via framer_set_item_attributes " +
      'with fieldData: { fieldId: { type: "image", value: returnedUrl } }. ' +
      "Optionally accepts a referenceImageUrl to guide the style/composition of the generated image.",
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
          "URL of a reference image to guide style/composition. Pass the user's uploaded image URL here when available.",
        ),
    }),
    execute: async ({ prompt, context, referenceImageUrl }) => {
      const startMs = Date.now();
      const config = getAIConfig();

      if (!config) {
        return { success: false, error: "AI features are not configured." };
      }

      logEvent("info", "ai.tool.generate_image.called", {
        promptLength: prompt.length,
        hasContext: Boolean(context),
        hasReferenceImage: Boolean(referenceImageUrl),
      });

      try {
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

        if (referenceImageUrl) {
          userContent.push({ type: "image", image: referenceImageUrl });
        }

        const systemPrompt = await getImageSystemPrompt();

        const result = await generateText({
          model: config.provider(config.imageModel),
          system: systemPrompt,
          messages: [{ role: "user" as const, content: userContent }],
          providerOptions: {
            vertex: { generationConfig: { responseModalities: ["IMAGE", "TEXT"] } },
          },
          maxRetries: 1,
        });

        const imageFile = result.files?.find((f) =>
          f.mediaType?.startsWith("image/"),
        );

        if (!imageFile) {
          logEvent("warn", "ai.tool.generate_image.no_image", {
            durationMs: Date.now() - startMs,
          });
          return {
            success: false,
            error: "The model did not return an image. Try a different prompt.",
          };
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

        logEvent("info", "ai.tool.generate_image.completed", {
          durationMs: Date.now() - startMs,
          assetUrl: asset.url,
        });

        try {
          const { orgId, userId } = await auth();
          if (orgId && userId) {
            const promptTokens = result.usage?.inputTokens ?? 0;
            const completionTokens = result.usage?.outputTokens ?? 0;
            const hasUsage = promptTokens > 0 || completionTokens > 0;
            const totalTokens = hasUsage
              ? promptTokens + completionTokens
              : FALLBACK_IMAGE_TOKEN_COST;

            void trackTokenUsage({
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
          // Auth context may not be available — don't block the tool response
        }

        return {
          success: true,
          url: asset.url,
          thumbnailUrl: asset.thumbnailUrl,
          mimeType,
          prompt,
        };
      } catch (error) {
        logError("ai.tool.generate_image.failed", error);
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    },
  });
}

export function createScopedGenerateAndUploadImageTool(
  runInFramerContext: RunInFramerContext,
) {
  return buildGenerateAndUploadImageTool(runInFramerContext);
}

export const generateAndUploadImage = buildGenerateAndUploadImageTool();
