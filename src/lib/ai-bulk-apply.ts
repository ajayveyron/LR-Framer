import type { BlogPostRecord, DashboardFieldValue } from "@/lib/cms-types";
import type { ProposedEdit } from "@/lib/ai-edit-parser";
import { logEvent, logError } from "@/lib/logger";

export interface BulkApplyResult {
  succeeded: string[];
  failed: Array<{ rowId: string; error: string }>;
}

/**
 * Applies proposed edits by calling `PUT /api/posts/[id]` for each row.
 * Continues on individual failures so partial success is possible.
 *
 * @param edits - The proposed edits to apply
 * @param posts - The current post data (used to build the full update payload)
 * @returns Result with succeeded/failed row IDs
 */
export async function applyBulkEdits(
  edits: ProposedEdit[],
  posts: BlogPostRecord[],
): Promise<BulkApplyResult> {
  const startMs = Date.now();
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const succeeded: string[] = [];
  const failed: Array<{ rowId: string; error: string }> = [];

  for (const edit of edits) {
    const post = postMap.get(edit.rowId);
    if (!post) {
      failed.push({ rowId: edit.rowId, error: "Post not found in local cache." });
      continue;
    }

    const nextFieldValues: Record<string, DashboardFieldValue> = {
      ...post.fieldValues,
    };

    for (const [fieldId, change] of Object.entries(edit.changes)) {
      nextFieldValues[fieldId] = change.proposedValue;
    }

    try {
      const response = await fetch(`/api/posts/${edit.rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: post.slug,
          draft: post.draft,
          fieldValues: nextFieldValues,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        failed.push({
          rowId: edit.rowId,
          error: data.error ?? `HTTP ${response.status}`,
        });
        continue;
      }

      succeeded.push(edit.rowId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network error";
      failed.push({ rowId: edit.rowId, error: message });
    }
  }

  logEvent("info", "ai.bulk_edit.applied", {
    totalEdits: edits.length,
    succeededCount: succeeded.length,
    failedCount: failed.length,
    durationMs: Date.now() - startMs,
  });

  if (failed.length > 0) {
    logError("ai.bulk_edit.partial_failure", new Error("Some edits failed"), {
      failed,
    });
  }

  return { succeeded, failed };
}
