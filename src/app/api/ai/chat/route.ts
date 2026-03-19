import { convertToModelMessages, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

import { createErrorJsonResponse } from "@/lib/api";
import { requireAIConfig } from "@/lib/ai-config";
import { getAIContextSnapshot, formatSnapshotForPrompt } from "@/lib/ai-context-snapshot";
import { AppError } from "@/lib/errors";
import { framerTools } from "@/lib/framer-tools";
import { generateAndUploadImage } from "@/lib/ai-image-tool";
import { webSearchTool } from "@/lib/ai-search-tool";
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
  activeCollectionId: z.string().optional(),
  activeCollectionName: z.string().optional(),
});

function buildSystemPrompt(
  rows: z.infer<typeof bodyDataSchema>["selectedRows"],
  fields: z.infer<typeof bodyDataSchema>["fieldDefinitions"],
  activeCollection?: { id: string; name: string },
  snapshotBlock?: string,
) {
  const fieldList = fields
    .map((f) => `- ${f.name} (id: ${f.id}, type: ${f.type})`)
    .join("\n");

  const collectionBlock = activeCollection
    ? `The active collection is "${activeCollection.name}" (id: ${activeCollection.id}). When the user refers to "blog", "posts", or "items" without specifying a collection, they mean this one. Use this collection ID directly — do NOT call framer_get_collections first.`
    : "No active collection is set. You may need to call framer_get_collections to discover available collections.";

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

${collectionBlock}

Available fields in the active collection:
${fieldList}

${selectionBlock}
${snapshotBlock ? `\n${snapshotBlock}\n` : ""}
PRESENTATION RULE — never show internal IDs to the user:
- When referring to collections, fields, items, or enum cases in your responses, use their human-readable names only (e.g. "Blogs", "Title", "Author").
- Never include raw IDs like (id: esdNAc4Vu) or field IDs in your messages. IDs are for your internal use when calling tools — users don't need to see them.
- When listing collections or items, present them as clean, readable lists with just names and relevant details.

TOOL RESULT DISPLAY RULE — do not repeat tool output data:
- The following tool results are automatically rendered as rich UI components in the chat: framer_get_collections (card grid), framer_get_collection_fields (field chips), framer_get_collection_items (table), framer_get_enum_cases (chips).
- When these tools return data, NEVER list, enumerate, or repeat the same data in your text response. The user already sees it rendered visually above your message.
- Your text response after these tools should ONLY be a brief one-sentence summary like "Here are your 6 collections" or "Found 12 items in the Blogs collection." Do NOT list names, titles, slugs, field names, or any item-level details — the UI already shows all of that.

You have access to web search via the web_search tool. When the user asks about current events, latest documentation, pricing, comparisons, or anything that benefits from up-to-date web data, use it. It returns a grounded answer with source URLs.

You can generate images using the generate_and_upload_image tool. It creates an AI image from a text prompt and uploads it to Framer as an asset. The tool returns the uploaded image URL. To set it on a CMS item's image field, chain it with framer_set_item_attributes using fieldData: { fieldId: { type: "image", value: returnedUrl } }.

If the user has attached an image in their message, pass its URL as the referenceImageUrl parameter so the generated image matches the style and composition of the reference.

IMPORTANT: You may only call generate_and_upload_image ONCE per user message. If the user asks for images for multiple items, generate one image and reuse it, or ask the user to send separate messages for each image. Never batch multiple image generation calls in a single turn.

You have access to Framer CMS tools that let you directly interact with the Framer project:
- framer_get_project_info: Get project name and ID
- framer_get_publish_info: Get current deployment info for staging/production
- framer_get_collections: List all CMS collections
- framer_get_collection: Get a specific collection by ID
- framer_get_collection_fields: Get all fields in a collection
- framer_get_collection_items: Get all items in a collection
- framer_get_enum_cases: Get cases for an enum field
- framer_set_collection_as_active: Set a collection as active in the Framer UI

WRITE OPERATIONS — all mutations require user confirmation:
For ANY operation that creates, updates, deletes, or publishes data, you MUST use the propose_cms_action tool. This includes:
- Adding or upserting items → action: "add_items"
- Removing items → action: "remove_item" or "remove_items"
- Updating item attributes (slug, draft, field data) → action: "set_item_attributes"
- Adding/renaming/removing/reordering enum cases → action: "add_enum_case", "update_enum_case", "remove_enum_case", "set_enum_case_order"
- Publishing the site → action: "publish"

NEVER try to call the old direct write tools (framer_add_collection_items, framer_publish, etc.) — they no longer exist. Always use propose_cms_action with a clear description of what you're doing and why. The user will see a confirmation card and must click Approve before the action executes.

When proposing actions, write a clear, concise description that tells the user exactly what will happen. For example: "Add a new blog post titled 'Getting Started' as a draft" or "Remove 3 outdated changelog entries".

EFFICIENCY RULES — minimize tool calls and token usage:
- You have PRE-LOADED CONTEXT above with project info, all collections, their fields, and enum cases. Use that data directly instead of calling framer_get_project_info, framer_get_collections, framer_get_collection_fields, or framer_get_enum_cases. Only call these tools if you need to REFRESH the data after a mutation.
- When the user asks about items in a collection, call framer_get_collection_items ONCE with the collection ID from the pre-loaded context. Do NOT enumerate all collections and fetch items from each one.
- If the user asks to "find 1 item" or "find a few items" matching some criteria, fetch items from the active collection ONCE, scan the results yourself, and act on what you find. Do not make redundant calls.
- Only call framer_get_collections when the user explicitly asks about other collections or you genuinely don't know which collection to use.
- Prefer fewer, targeted tool calls over many exploratory ones.
- IMPORTANT: You already have field definitions for every collection in the pre-loaded context. When fetching items from any collection, the UI can use those field names directly — no need to call framer_get_collection_fields first.

When the user asks you to make changes to selected rows, use the propose_edits tool to suggest edits. For each row, provide the fieldId as the key and the new value directly. Example: changes: { "Fv4S6mkrw": "New description text" }.

CRITICAL: You already have the selected rows' data in this prompt. When the user asks to edit, update, or change a selected post, use propose_edits IMMEDIATELY with the data you already have. Do NOT call framer_get_collection_items or any other fetch tool first — you already have everything you need. Only call framer_get_collection_items if the user explicitly asks about items that are NOT in the selected rows above.

When the user asks about the Framer project, collections, publishing, or wants to perform operations beyond the selected rows, use the appropriate framer_* tool or propose_cms_action.

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

    const { selectedRows, fieldDefinitions, activeCollectionId, activeCollectionName } = dataResult.data;

    const activeCollection = activeCollectionId && activeCollectionName
      ? { id: activeCollectionId, name: activeCollectionName }
      : undefined;

    // Build a context snapshot so the agent starts with project info,
    // all collections, their fields, and enum cases already loaded.
    const snapshot = await getAIContextSnapshot();
    const snapshotBlock = formatSnapshotForPrompt(snapshot);

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
        parts: msg.parts
          .map((p: any) => {
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
                return { ...p, url: match[2], mediaType: match[1] };
              }
              return p;
            }
            // Strip non-data-URL large file parts from history
            if (idx !== lastUserIdx && p.type === "file" && typeof p.url === "string" && p.url.length > MAX_FILE_URL) {
              return { type: "text", text: `[User attached an image: ${p.filename || "image"}]` };
            }
            // Patch dangling tool invocations (stopped mid-stream) with a
            // cancellation result so the model doesn't error on missing results
            if (p.type === "tool-invocation" && p.state !== "output-available") {
              return { ...p, state: "output-available", output: { _cancelled: true, message: "Tool call was cancelled by the user." } };
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
      system: buildSystemPrompt(selectedRows, fieldDefinitions, activeCollection, snapshotBlock),
      messages: await convertToModelMessages(sanitizedMessages),
      stopWhen: stepCountIs(10),
      tools: {
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
        web_search: webSearchTool,
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

    return result.toUIMessageStreamResponse({
      sendSources: true,
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          return {
            inputTokens: part.totalUsage.inputTokens,
            outputTokens: part.totalUsage.outputTokens,
            totalTokens: part.totalUsage.totalTokens,
          };
        }
        return undefined;
      },
    });
  } catch (error) {
    logError("ai.bulk_edit.failed", error);
    return createErrorJsonResponse(error);
  }
}
