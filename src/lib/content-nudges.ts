import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  DashboardFieldDefinition,
} from "@/lib/cms-types";

export interface ContentNudge {
  postId: string;
  issues: string[];
  prompt: string;
}

function findFieldByLogicalKey(
  metadata: BlogCollectionMetadata,
  logicalKey: string,
): DashboardFieldDefinition | undefined {
  const fieldId = metadata.logicalFields[logicalKey as keyof typeof metadata.logicalFields];
  if (!fieldId) return undefined;
  return metadata.fields.find((f) => f.id === fieldId);
}

function findFieldByType(
  metadata: BlogCollectionMetadata,
  type: string,
): DashboardFieldDefinition | undefined {
  return metadata.fields.find((f) => f.type === type);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isShortTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  return title.trim().length < 10;
}

function isBodyTooShort(value: unknown): boolean {
  if (typeof value !== "string") return true;
  // Strip HTML tags for length check
  const text = value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length < 50;
}

function isStaleDraft(post: BlogPostRecord): boolean {
  if (!post.draft) return false;
  const updated = post.lastUpdated ?? post.createdAt;
  if (!updated) return false;
  const daysSince =
    (Date.now() - new Date(updated).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 7;
}

/**
 * Analyze a post for content quality issues.
 * Returns null if no issues found.
 */
export function analyzePost(
  post: BlogPostRecord,
  metadata: BlogCollectionMetadata,
): ContentNudge | null {
  const issues: string[] = [];

  // Check title quality
  if (isShortTitle(post.title)) {
    issues.push("Title is very short or missing");
  }

  // Check body content
  const bodyField = findFieldByLogicalKey(metadata, "body");
  if (bodyField) {
    const bodyValue = post.fieldValues[bodyField.id];
    if (isEmptyValue(bodyValue)) {
      issues.push("Body content is empty");
    } else if (isBodyTooShort(bodyValue)) {
      issues.push("Body content is very short");
    }
  }

  // Check for missing image field
  const imageField = findFieldByType(metadata, "image");
  if (imageField) {
    const imageValue = post.fieldValues[imageField.id];
    if (isEmptyValue(imageValue)) {
      issues.push(`Missing ${imageField.name.toLowerCase()}`);
    }
  }

  // Check for stale drafts
  if (isStaleDraft(post)) {
    issues.push("Draft hasn't been updated in over a week");
  }

  if (issues.length === 0) return null;

  const prompt = `Review "${post.title || "this post"}" — it has ${issues.length === 1 ? "an issue" : "some issues"}: ${issues.join(", ")}. Help me fix ${issues.length === 1 ? "it" : "them"}.`;

  return { postId: post.id, issues, prompt };
}

/**
 * Analyze all posts and return a map of postId → nudge.
 */
export function analyzeAllPosts(
  posts: BlogPostRecord[],
  metadata: BlogCollectionMetadata,
): Map<string, ContentNudge> {
  const nudges = new Map<string, ContentNudge>();
  for (const post of posts) {
    const nudge = analyzePost(post, metadata);
    if (nudge) {
      nudges.set(post.id, nudge);
    }
  }
  return nudges;
}

// ---------------------------------------------------------------------------
// Site-level insights (cross-post analysis)
// ---------------------------------------------------------------------------

export type InsightSeverity = "info" | "warning";

export interface SiteInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  /** Number of affected items */
  count: number;
  /** Pre-built prompt to send to the AI agent */
  prompt: string;
  /** Item IDs affected (for context) */
  affectedItemIds: string[];
}

interface ImageFieldMissingAlt {
  postId: string;
  postTitle: string;
  fieldId: string;
  fieldName: string;
  imageUrl: string;
}

/**
 * Check if an image field value is missing alt text.
 * Image values can be:
 * - string (URL only, no alt) → missing
 * - { url, alt } where alt is null/empty → missing
 * - { url, alt } where alt is set → has alt
 * - null → no image at all, skip
 */
function isImageMissingAlt(value: unknown): { missing: boolean; url: string | null } {
  if (value === null || value === undefined) return { missing: false, url: null };
  if (typeof value === "string") return { missing: true, url: value };
  if (typeof value === "object" && value !== null && "url" in value) {
    const img = value as { url: string; alt?: string | null };
    if (!img.alt || img.alt.trim().length === 0) {
      return { missing: true, url: img.url };
    }
    return { missing: false, url: img.url };
  }
  return { missing: false, url: null };
}

/**
 * Scan all posts for images missing alt text and return a site-level insight.
 */
export function scanMissingAltText(
  posts: BlogPostRecord[],
  metadata: BlogCollectionMetadata,
): SiteInsight | null {
  const imageFields = metadata.fields.filter((f) => f.type === "image");
  if (imageFields.length === 0) return null;

  const missing: ImageFieldMissingAlt[] = [];

  for (const post of posts) {
    for (const field of imageFields) {
      const value = post.fieldValues[field.id];
      const check = isImageMissingAlt(value);
      if (check.missing && check.url) {
        missing.push({
          postId: post.id,
          postTitle: post.title || post.slug,
          fieldId: field.id,
          fieldName: field.name,
          imageUrl: check.url,
        });
      }
    }
  }

  if (missing.length === 0) return null;

  const uniquePostIds = [...new Set(missing.map((m) => m.postId))];
  const imageCount = missing.length;
  const postCount = uniquePostIds.length;

  const itemList = missing
    .slice(0, 20)
    .map((m) => `- "${m.postTitle}" → ${m.fieldName} (item ${m.postId})`)
    .join("\n");
  const truncated = missing.length > 20 ? `\n...and ${missing.length - 20} more` : "";

  const prompt = `${imageCount} CMS image${imageCount === 1 ? "" : "s"} across ${postCount} item${postCount === 1 ? "" : "s"} are missing alt text. Analyze each image and suggest descriptive alt text for accessibility and SEO. Here are the affected items:\n\n${itemList}${truncated}\n\nPlease fetch these items, look at the images, and propose alt text for each one. Show me the suggestions before applying.`;

  return {
    id: "missing-alt-text",
    severity: "warning",
    title: `${imageCount} image${imageCount === 1 ? "" : "s"} missing alt text`,
    description: `${postCount} item${postCount === 1 ? " has" : "s have"} images without alt text, which hurts accessibility and SEO.`,
    count: imageCount,
    prompt,
    affectedItemIds: uniquePostIds,
  };
}

/**
 * Run all site-level insight scans and return the results.
 */
export function scanSiteInsights(
  posts: BlogPostRecord[],
  metadata: BlogCollectionMetadata,
): SiteInsight[] {
  const insights: SiteInsight[] = [];

  const altTextInsight = scanMissingAltText(posts, metadata);
  if (altTextInsight) insights.push(altTextInsight);

  return insights;
}
