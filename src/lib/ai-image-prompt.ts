/**
 * System-level style direction prepended to every image generation prompt.
 * Derived from research on structured prompting for Gemini image models.
 *
 * Sources (content rephrased for compliance with licensing restrictions):
 * - Google Cloud "Ultimate prompting guide for Nano Banana" (2026)
 * - Skywork AI "Nano Banana Prompt Engineering Best Practices" (2025)
 * - CyberCorsairs "10-Part AI Image Prompt Template" (2025)
 */
export const IMAGE_SYSTEM_PROMPT = [
  "STYLE: Editorial illustration with a sophisticated, premium  aesthetic.",
  "COMPOSITION: Clean layout with generous negative space, single focal point, suitable for a blog header.",
  "MEDIUM: Flat vector shapes layered with subtle depth — think risograph print or screen-printed editorial art, not 3D renders.",
  "CONSTRAINTS: No text or typography in the image unless specifically asked. No watermarks. No people or faces. No busy patterns. No generic stock-photo feel. no gradients at all especillay. blue or pruple unless requested or are inth reference images. Avoid photorealism — lean editorial and graphic.",
].join("\n");

/**
 * Builds a default prompt from CMS context when the user leaves the
 * prompt field empty.
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
 * Builds an enriched prompt for AI image generation by combining
 * the user's prompt with contextual CMS data and structured style direction.
 */
export function buildImagePrompt(
  userPrompt: string,
  context?: {
    title?: string;
    slug?: string;
    bodyText?: string;
  },
): string {
  if (!context) return userPrompt;

  const parts: string[] = [userPrompt];

  const contextLines: string[] = [];
  if (context.title) contextLines.push(`Title: ${context.title}`);
  if (context.slug) contextLines.push(`Slug: ${context.slug}`);
  if (context.bodyText) {
    const truncated =
      context.bodyText.length > 500
        ? `${context.bodyText.slice(0, 497)}…`
        : context.bodyText;
    contextLines.push(`Content excerpt: ${truncated}`);
  }

  if (contextLines.length > 0) {
    parts.push(`\nContext:\n${contextLines.join("\n")}`);
  }

  return parts.join("");
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
): Promise<{ imageBase64: string; mimeType: string }> {
  const response = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, context, referenceImageUrl }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error ?? `Image generation failed (${response.status})`);
  }

  return response.json() as Promise<{ imageBase64: string; mimeType: string }>;
}
