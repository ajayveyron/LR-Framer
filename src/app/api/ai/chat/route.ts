import { convertToModelMessages, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

import { createErrorJsonResponse } from "@/lib/api";
import { requireAIConfig } from "@/lib/ai-config";
import { AppError } from "@/lib/errors";
import { framerTools } from "@/lib/framer-tools";
import { generateAndUploadImage } from "@/lib/ai-image-tool";
import { logEvent, logError } from "@/lib/logger";

export const runtime = "nodejs";

// Allow large request bodies — conversation history with tool results can grow
export const maxDuration = 120;

const bodyDataSchema = z.object({
  selectedRows: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      fieldValues: z.record(z.string(), z.unknown()),
    }),
  ),
  fieldDefinitions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
    }),
  ),
});

function buildSystemPrompt(
  rows: z.infer<typeof bodyDataSchema>["selectedRows"],
  fields: z.infer<typeof bodyDataSchema>["fieldDefinitions"],
) {
  const fieldList = fields
    .map((f) => `- ${f.name} (id: ${f.id}, type: ${f.type})`)
    .join("\n");

  const selectionBlock =
    rows.length > 0
      ? `The user has selected ${rows.length} CMS row(s). Here they are:\n\n${rows
          .map((r) => {
            const vals = Object.entries(r.fieldValues)
              .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
              .join("\n");
            return `Row "${r.title}" (id: ${r.id}, slug: ${r.slug}):\n${vals}`;
          })
          .join("\n\n")}`
      : "No rows are currently selected. The user can still ask about the project, collections, publishing, or any Framer CMS operation.";

  return `You are an AI assistant for a CMS dashboard powered by Framer.

Available fields in the active collection:
${fieldList}

${selectionBlock}

You have access to Google Search for real-time web information. When the user asks about current events, latest documentation, pricing, comparisons, or anything that benefits from up-to-date web data, use the google_search tool.

You can generate images using the generate_and_upload_image tool. It creates an AI image from a text prompt and uploads it to Framer as an asset. The tool returns the uploaded image URL. To set it on a CMS item's image field, chain it with framer_set_item_attributes using fieldData: { fieldId: { type: "image", value: returnedUrl } }.

If the user has attached an image in their message, pass its URL as the referenceImageUrl parameter so the generated image matches the style and composition of the reference.

IMPORTANT: You may only call generate_and_upload_image ONCE per user message. If the user asks for images for multiple items, generate one image and reuse it, or ask the user to send separate messages for each image. Never batch multiple image generation calls in a single turn.

You also have access to Framer CMS tools that let you directly interact with the Framer project:
- framer_get_project_info: Get project name and ID
- framer_get_publish_info: Get current deployment info for staging/production
- framer_publish: Publish the site (creates a new deployment)
- framer_get_collections: List all CMS collections
- framer_get_collection: Get a specific collection by ID
- framer_get_collection_fields: Get all fields in a collection
- framer_get_collection_items: Get all items in a collection
- framer_add_collection_items: Add or upsert items in a collection
- framer_remove_collection_items: Remove items by ID
- framer_set_item_attributes: Update a single item's slug, draft status, or field data
- framer_remove_item: Remove a single item
- framer_get_enum_cases: Get cases for an enum field
- framer_add_enum_case: Add a new enum case
- framer_set_enum_case_order: Reorder enum cases
- framer_update_enum_case: Rename an enum case
- framer_remove_enum_case: Remove an enum case
- framer_set_collection_as_active: Set a collection as active in the Framer UI

When the user asks you to make changes to selected rows, use the propose_edits tool to suggest edits. For each row, provide the fieldId as the key and the new value directly. Example: changes: { "Fv4S6mkrw": "New description text" }.

When the user asks about the Framer project, collections, publishing, or wants to perform operations beyond the selected rows, use the appropriate framer_* tool.

Be concise and helpful. If the user's request is ambiguous, ask for clarification before proposing edits.`;
}

export async function POST(request: Request) {
  const startMs = Date.now();

  try {
    const config = requireAIConfig();
    const body = await request.json();
    const { messages } = body;

    if (!Array.isArray(messages)) {
      throw new AppError("messages array is required.", 400);
    }

    const dataResult = bodyDataSchema.safeParse(body);
    if (!dataResult.success) {
      throw new AppError("Invalid data payload: " + dataResult.error.message, 400);
    }

    const { selectedRows, fieldDefinitions } = dataResult.data;

    // Server-side safety: sanitize incoming message history to prevent
    // massive payloads from blowing up the model context or SSE stream.
    // - Convert data: URL file parts to inline base64 (Vertex AI rejects data: scheme)
    // - Truncate oversized tool results (>2KB)
    // - Strip large file parts from all but the last user message
    //   so the model sees the current image but history stays lightweight
    const MAX_TOOL_RESULT = 2_000;
    const MAX_FILE_URL = 50_000;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if ((messages as any[])[i]?.role === "user") { lastUserIdx = i; break; }
    }
    const sanitizedMessages = (messages as any[]).map((msg: any, idx: number) => {
      if (!Array.isArray(msg.parts)) return msg;
      return {
        ...msg,
        parts: msg.parts.map((p: any) => {
          // Convert data: URL file parts to inline base64 so Vertex AI
          // doesn't try to fetch them as HTTP URLs
          if (p.type === "file" && typeof p.url === "string" && p.url.startsWith("data:")) {
            // Strip old images from history — only keep the current message's
            if (idx !== lastUserIdx) {
              return { type: "text", text: `[User attached an image: ${p.filename || "image"}]` };
            }
            // Parse data URL: data:<mediaType>;base64,<data>
            const match = p.url.match(/^data:([^;]+);base64,(.+)$/s);
            if (match) {
              // Set url to raw base64 — convertToModelMessages passes
              // url as the `data` field of a FilePart, which expects
              // raw base64 (not a full data: URL)
              return { ...p, url: match[2], mediaType: match[1] };
            }
            return p;
          }
          // Strip non-data-URL large file parts from history
          if (idx !== lastUserIdx && p.type === "file" && typeof p.url === "string" && p.url.length > MAX_FILE_URL) {
            return { type: "text", text: `[User attached an image: ${p.filename || "image"}]` };
          }
          // Truncate oversized tool results
          if (p.type === "tool-invocation" && p.result !== undefined) {
            const s = JSON.stringify(p.result);
            if (s.length > MAX_TOOL_RESULT) {
              return { ...p, result: { _truncated: true, preview: s.slice(0, MAX_TOOL_RESULT) } };
            }
          }
          return p;
        }),
      };
    });

    logEvent("info", "ai.bulk_edit.requested", {
      selectedRowCount: selectedRows.length,
      messageCount: messages.length,
      model: config.textModel,
    });

    const result = streamText({
      model: config.provider(config.textModel),
      system: buildSystemPrompt(selectedRows, fieldDefinitions),
      messages: await convertToModelMessages(sanitizedMessages),
      stopWhen: stepCountIs(10),
      tools: {
        google_search: config.provider.tools.googleSearch({}),
        propose_edits: tool({
          description: "Propose field edits for selected CMS rows. Use this when the user asks to change, update, or modify fields across the selected rows.",
          inputSchema: z.object({
            edits: z.array(
              z.object({
                rowId: z.string().describe("The id of the CMS row to edit"),
                changes: z.record(
                  z.string().describe("The field id to change"),
                  z.unknown().describe("The new value for the field"),
                ).describe("Map of fieldId to new value"),
              }),
            ).describe("Array of row edits to propose"),
          }),
          // No-op execute — the tool is rendered client-side.
          execute: async (input) => input,
        }),
        ...framerTools,
        generate_and_upload_image: generateAndUploadImage,
      },
      onFinish: ({ usage }) => {
        logEvent("info", "ai.bulk_edit.completed", {
          selectedRowCount: selectedRows.length,
          durationMs: Date.now() - startMs,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
        });
      },
    });

    return result.toUIMessageStreamResponse({ sendSources: true });
  } catch (error) {
    logError("ai.bulk_edit.failed", error);
    return createErrorJsonResponse(error);
  }
}
