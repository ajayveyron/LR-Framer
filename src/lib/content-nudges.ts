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
