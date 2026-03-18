/**
 * Builds a default prompt from CMS context when the user leaves the
 * prompt field empty.
 */
export function buildDefaultPrompt(context?: {
  title?: string;
  slug?: string;
}): string {
  if (context?.title) {
    return `A modern, clean blog header image for an article titled "${context.title}"`;
  }
  return "A modern, clean blog header image with abstract shapes and soft colors";
}

/**
 * Builds an enriched prompt for AI image generation by combining
 * the user's prompt with contextual CMS data.
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
