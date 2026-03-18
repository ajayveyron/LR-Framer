// ---------------------------------------------------------------------------
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  IMAGE GENERATION PROMPT ARCHITECTURE                                  │
// │                                                                        │
// │  SYSTEM PROMPT  (IMAGE_SYSTEM_PROMPT)                                  │
// │    → Persistent style rules sent via `system` param in generateText.   │
// │    → Controls: visual style, composition, medium, and hard constraints │
// │    → Same for every request — the user never sees or edits this.       │
// │                                                                        │
// │  USER PROMPT  (built by buildImagePrompt / buildDefaultPrompt)         │
// │    → Sent via `prompt` param in generateText.                          │
// │    → Contains: what the user typed (or a default) + CMS context.      │
// │    → Changes per request.                                              │
// │                                                                        │
// │  Both are assembled in: src/app/api/ai/image/route.ts                 │
// └─────────────────────────────────────────────────────────────────────────┘
// ---------------------------------------------------------------------------

/**
 * ── SYSTEM PROMPT ──
 * Sent as the `system` parameter to generateText().
 * This is the "creative director" — it tells the model HOW to generate,
 * regardless of WHAT the user asks for.
 *
 * Sources (content rephrased for compliance with licensing restrictions):
 * - Google Cloud "Ultimate prompting guide for Nano Banana" (2026)
 * - Skywork AI "Nano Banana Prompt Engineering Best Practices" (2025)
 * - CyberCorsairs "10-Part AI Image Prompt Template" (2025)
 */
export const IMAGE_SYSTEM_PROMPT = [
  "You are an AI image generator and your job is to generate images as per the user's prompt and given context. it should be very clean, professinoal and very less AI like. no gears, brain, cloud, rocket, shield, or any ai staturated graphics. if you ahve any illustrations or graphics in the image then ensure then propelrly feel seemless with the grpahic and ot unnecessaery eleveated or out of place.",
].join("\n");

/**
 * ── USER PROMPT (default fallback) ──
 * Used when the user leaves the prompt field empty in the dialog.
 * Generates a subject line from CMS context (title) or a generic fallback.
 * This becomes the `prompt` param — the model sees it as the user's request.
 */
export function buildDefaultPrompt(context?: {
  title?: string;
  slug?: string;
}): string {
  const subject = context?.title
    ? `An abstract editorial illustration that visually represents the concept of "${context.title}"`
    : "An abstract editorial illustration with geometric shapes conveying technology and creativity";
    return subject;
}

/**
 * ── USER PROMPT (enriched) ──
 * Combines the user's typed prompt with CMS context (title, slug, body excerpt).
 * This is what goes into the `prompt` param of generateText().
 *
 * CMS context is ALWAYS included when available — even if the user typed
 * something. The prompt clearly labels what is the user's request vs.
 * background context so the model treats them differently.
 *
 * Example output:
 *   "USER REQUEST:
 *    A rocket launching from a laptop
 *
 *    BLOG CONTEXT (for understanding only — do not directly reproduce this text in the image):
 *    Title: How We Scaled Our API
 *    Slug: scaling-our-api
 *    Content excerpt: We went from 100 to 10,000 requests per second…"
 */
export function buildImagePrompt(
  userPrompt: string,
  context?: {
    title?: string;
    slug?: string;
    bodyText?: string;
  },
): string {
  const contextLines: string[] = [];
  if (context?.title) contextLines.push(`Title: ${context.title}`);
  // if (context?.slug) contextLines.push(`Slug: ${context.slug}`);
  if (context?.bodyText) {
    const truncated =
      context.bodyText.length > 500
        ? `${context.bodyText.slice(0, 497)}…`
        : context.bodyText;
    contextLines.push(`Content excerpt: ${truncated}`);
  }

  // No context available — just return the user's request as-is
  if (contextLines.length === 0) return userPrompt;

  // Build a clearly labeled prompt with both sections
  const parts: string[] = [
    `USER REQUEST:\n${userPrompt}`,
    `\nBLOG CONTEXT (for understanding only — do not directly reproduce this text in the image or have it directly impact the response, its just for your understanding):\n${contextLines.join("\n")}`,
  ];

  return parts.join("\n");
}

/**
 * Derives alt text from the generation prompt.
 * Truncates to 125 chars (screen-reader best practice).
 */
export function buildAltText(prompt: string): string {
  const cleaned = prompt.replace(/\n/g, " ").trim();
  return cleaned.length > 125 ? `${cleaned.slice(0, 124)}…` : cleaned;
}

/**
 * Calls the `/api/ai/image` endpoint and returns the base64 image data.
 */
export async function generateAIImage(
  prompt: string,
  context?: {
    title?: string;
    slug?: string;
    bodyText?: string;
  },
  referenceImageUrl?: string,
  signal?: AbortSignal,
): Promise<{ imageBase64: string; mimeType: string }> {
  const response = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, context, referenceImageUrl }),
    signal,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error ?? `Image generation failed (${response.status})`);
  }

  return response.json() as Promise<{ imageBase64: string; mimeType: string }>;
}
