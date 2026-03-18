import { streamText, tool } from "ai";
import { z } from "zod";

import { createErrorJsonResponse } from "@/lib/api";
import { requireAIConfig } from "@/lib/ai-config";
import { AppError } from "@/lib/errors";
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

  const rowSummaries = rows
    .map((r) => {
      const vals = Object.entries(r.fieldValues)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
        .join("\n");
      return `Row "${r.title}" (id: ${r.id}, slug: ${r.slug}):\n${vals}`;
    })
    .join("\n\n");

  return `You are an AI assistant for a CMS dashboard. The user has selected ${rows.length} CMS row(s) and wants to bulk-edit them.

Available fields:
${fieldList}

Selected rows:
${rowSummaries}

When the user asks you to make changes, use the propose_edits tool to suggest edits. Always include the current value and proposed value for each change so the user can review a diff before applying.

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

    const dataResult = bodyDataSchema.safeParse(body.data ?? {});
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
      messages,
      tools: {
        propose_edits: tool({
          description: "Propose field edits for selected CMS rows. Use this when the user asks to change, update, or modify fields across the selected rows.",
          inputSchema: z.object({
            edits: z.array(
              z.object({
                rowId: z.string().describe("The id of the CMS row to edit"),
                changes: z.record(
                  z.string(),
                  z.object({
                    fieldName: z.string().describe("Human-readable field name"),
                    currentValue: z.unknown().describe("Current value of the field"),
                    proposedValue: z.unknown().describe("New value to set"),
                  }),
                ).describe("Map of fieldId to change details"),
              }),
            ).describe("Array of row edits to propose"),
          }),
        }),
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

    return result.toUIMessageStreamResponse();
  } catch (error) {
    logError("ai.bulk_edit.failed", error);
    return createErrorJsonResponse(error);
  }
}
