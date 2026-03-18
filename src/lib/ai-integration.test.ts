/**
 * Integration tests for AI features — hits real Vertex AI API.
 *
 * Requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION env vars.
 * Run with: node --import tsx --env-file=.env --test src/lib/ai-integration.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { streamText, generateImage, tool } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Setup — read env directly to avoid the framer-api CJS import chain
// ---------------------------------------------------------------------------

const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
const textModel = "gemini-3.1-pro-preview";
const imageModel = "gemini-3.1-flash-image-preview";
const shouldSkip = !project || !location;

function getProvider() {
  return createVertex({ project: project!, location: location! });
}

// ---------------------------------------------------------------------------
// Chat / streamText integration
// ---------------------------------------------------------------------------

describe("AI Chat — streamText integration", { skip: shouldSkip }, () => {
  it("streams a text response from Gemini", async () => {
    const provider = getProvider();

    const result = streamText({
      model: provider(textModel),
      system: "You are a helpful CMS assistant. Be very brief.",
      messages: [{ role: "user", content: "Say hello in one word." }],
    });

    const chunks: string[] = [];
    for await (const chunk of result.textStream) {
      chunks.push(chunk);
    }

    const fullText = chunks.join("");
    assert.ok(fullText.length > 0, "Should receive non-empty text from Gemini");
  });

  it("invokes the propose_edits tool when asked to edit", async () => {
    const provider = getProvider();

    const result = streamText({
      model: provider(textModel),
      system: `You are a CMS assistant. The user selected 1 row:
Row "Hello World" (id: row-1, slug: hello-world):
  title: "Hello World"
  author: "Test Author"

Available fields:
- Title (id: title, type: string)
- Author (id: author, type: string)

When asked to make changes, ALWAYS use the propose_edits tool.`,
      messages: [
        { role: "user", content: "Change the title to 'Updated Title'" },
      ],
      tools: {
        propose_edits: tool({
          description: "Propose field edits for selected CMS rows.",
          inputSchema: z.object({
            edits: z.array(
              z.object({
                rowId: z.string(),
                changes: z.record(
                  z.string(),
                  z.object({
                    fieldName: z.string(),
                    currentValue: z.unknown(),
                    proposedValue: z.unknown(),
                  }),
                ),
              }),
            ),
          }),
        }),
      },
    });

    // Consume the full stream and collect tool calls
    const parts: Array<{ type: string; [key: string]: unknown }> = [];
    for await (const part of result.fullStream) {
      parts.push(part as { type: string });
    }

    const toolCalls = parts.filter((p) => p.type === "tool-call");
    assert.ok(
      toolCalls.length > 0,
      `Expected at least one tool call, got parts: ${parts.map((p) => p.type).join(", ")}`,
    );

    const call = toolCalls[0] as {
      toolName?: string;
      input?: Record<string, unknown>;
    };
    assert.equal(call.toolName, "propose_edits");

    // fullStream tool-call parts expose `input` (the raw model output)
    const input = call.input;
    assert.ok(input, "Tool call should have input");

    const edits = Array.isArray(input.edits) ? input.edits : [];
    assert.ok(
      edits.length > 0,
      `Should propose at least one edit, got input: ${JSON.stringify(input)}`,
    );

    const edit = edits[0] as Record<string, unknown>;
    assert.equal(edit.rowId, "row-1", "Edit should target row-1");
    assert.ok(edit.changes, "Edit should have changes object");
  });

  it("handles multi-row context correctly", async () => {
    const provider = getProvider();

    const result = streamText({
      model: provider(textModel),
      system: `You are a CMS assistant. The user selected 3 rows:
Row "Post A" (id: row-a): title: "Post A", author: "Alice"
Row "Post B" (id: row-b): title: "Post B", author: "Bob"
Row "Post C" (id: row-c): title: "Post C", author: "Charlie"

Available fields:
- Title (id: title, type: string)
- Author (id: author, type: string)

When asked to make changes, ALWAYS use the propose_edits tool. Include ALL selected rows in your response.`,
      messages: [
        {
          role: "user",
          content: "Set the author to 'LinkRunner Team' for all rows",
        },
      ],
      tools: {
        propose_edits: tool({
          description: "Propose field edits for selected CMS rows.",
          inputSchema: z.object({
            edits: z.array(
              z.object({
                rowId: z.string(),
                changes: z.record(
                  z.string(),
                  z.object({
                    fieldName: z.string(),
                    currentValue: z.unknown(),
                    proposedValue: z.unknown(),
                  }),
                ),
              }),
            ),
          }),
        }),
      },
    });

    const parts: Array<{ type: string; [key: string]: unknown }> = [];
    for await (const part of result.fullStream) {
      parts.push(part as { type: string });
    }

    const toolCalls = parts.filter((p) => p.type === "tool-call");
    assert.ok(toolCalls.length > 0, "Should invoke propose_edits");

    const input = (toolCalls[0] as { input?: Record<string, unknown> }).input;
    assert.ok(input, "Tool call should have input");

    const edits = Array.isArray(input.edits) ? input.edits : [];
    assert.equal(
      edits.length,
      3,
      `Should propose edits for all 3 rows, got: ${JSON.stringify(edits)}`,
    );

    const rowIds = edits
      .map((e: Record<string, unknown>) => e.rowId as string)
      .sort();
    assert.deepStrictEqual(rowIds, ["row-a", "row-b", "row-c"]);
  });
});

// ---------------------------------------------------------------------------
// Image generation integration
// ---------------------------------------------------------------------------

describe("AI Image — generateImage integration", { skip: shouldSkip }, () => {
  it("generates an image from a text prompt", async () => {
    const provider = getProvider();

    const result = await generateImage({
      model: provider.image(imageModel),
      prompt: "A simple blue square on a white background",
    });

    assert.ok(result.image, "Should return an image");
    assert.ok(
      result.image.base64.length > 100,
      "Base64 data should be non-trivial",
    );
  });

  it("generates an image with enriched CMS context prompt", async () => {
    const provider = getProvider();

    const enrichedPrompt = `A blog header image

Context:
Title: Getting Started with TypeScript
Slug: getting-started-typescript
Content excerpt: TypeScript is a typed superset of JavaScript.`;

    const result = await generateImage({
      model: provider.image(imageModel),
      prompt: enrichedPrompt,
    });

    assert.ok(result.image, "Should return an image");
    assert.ok(result.image.base64.length > 100);
  });
});
