import { tool, generateText } from "ai";
import { z } from "zod";

import { requireAIConfig } from "@/lib/ai-config";
import { logEvent, logError } from "@/lib/logger";

/**
 * Web search implemented as a regular function tool.
 *
 * Gemini flash-lite doesn't support mixing provider-defined tools
 * (like googleSearch grounding) with function calling tools in the
 * same request. So we implement search as a function tool that
 * internally makes a separate generateText call with ONLY the
 * googleSearch provider tool, then returns the grounded answer.
 */
export const webSearchTool = tool({
  description:
    "Search the web for current information. Use when the user asks about recent events, latest docs, pricing, comparisons, or anything that benefits from up-to-date web data. Returns a grounded answer with source URLs.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query — be specific and concise"),
  }),
  execute: async ({ query }) => {
    const startMs = Date.now();
    logEvent("info", "ai.tool.web_search.called", { query });

    try {
      const config = requireAIConfig();

      const { text, sources } = await generateText({
        // Use the same model but with ONLY the google search provider tool
        model: config.provider(config.textModel),
        tools: {
          google_search: config.provider.tools.googleSearch({}),
        },
        prompt: `Search the web and provide a concise, factual answer to: ${query}\n\nInclude specific details, numbers, and dates where relevant. Keep the answer under 500 words.`,
      });

      const sourceUrls = (sources ?? [])
        .filter((s): s is typeof s & { sourceType: "url"; url: string } => s.sourceType === "url")
        .map((s) => ({ url: s.url, title: s.title ?? "" }))
        .slice(0, 5);

      logEvent("info", "ai.tool.web_search.completed", {
        query,
        durationMs: Date.now() - startMs,
        sourceCount: sourceUrls.length,
        answerLength: text.length,
      });

      return {
        answer: text,
        sources: sourceUrls,
      };
    } catch (error) {
      logError("ai.tool.web_search.failed", error, { query });
      return {
        answer: `Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        sources: [],
      };
    }
  },
});
