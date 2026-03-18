import { convertToModelMessages, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

import { createErrorJsonResponse } from "@/lib/api";
import { requireAIConfig } from "@/lib/ai-config";
import { AppError } from "@/lib/errors";
import { framerTools } from "@/lib/framer-tools";
import { logEvent, logError } from "@/lib/logger";

export const runtime = "nodejs";

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

    logEvent("info", "ai.bulk_edit.requested", {
      selectedRowCount: selectedRows.length,
      messageCount: messages.length,
      model: config.textModel,
    });

    const result = streamText({
      model: config.provider(config.textModel),
      system: buildSystemPrompt(selectedRows, fieldDefinitions),
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
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
