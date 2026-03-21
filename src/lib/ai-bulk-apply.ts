import type { BlogPostRecord, DashboardFieldValue } from "@/lib/cms-types";
import type { ProposedEdit } from "@/lib/ai-edit-parser";
import { logEvent, logError } from "@/lib/logger";
import { getCollectionHeader } from "@/lib/product-framer-shared";

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

  // Separate edits with valid posts from missing ones
  const validEdits: Array<{ edit: ProposedEdit; post: BlogPostRecord }> = [];

  // For posts not in local cache, try fetching from the API
  const fetchResults = await Promise.allSettled(
    edits.map(async (edit) => {
      const local = postMap.get(edit.rowId);
      if (local) return { edit, post: local };

      const res = await fetch(`/api/posts/${edit.rowId}`, { headers: getCollectionHeader() });
      if (!res.ok) throw new Error(`Could not fetch post ${edit.rowId}`);
      const data = await res.json() as { post: BlogPostRecord };
      return { edit, post: data.post };
    }),
  );

  for (const result of fetchResults) {
    if (result.status === "fulfilled") {
      validEdits.push(result.value);
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : "Post not found";
      // Find the edit that failed — use index from the original array
      const idx = fetchResults.indexOf(result);
      failed.push({ rowId: edits[idx]!.rowId, error: msg });
    }
  }

  // Fire all PUTs in parallel
  const results = await Promise.allSettled(
    validEdits.map(async ({ edit, post }) => {
      const nextFieldValues: Record<string, DashboardFieldValue> = {
        ...post.fieldValues,
      };
      for (const [fieldId, newValue] of Object.entries(edit.changes)) {
        nextFieldValues[fieldId] = newValue;
      }

      const response = await fetch(`/api/posts/${edit.rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getCollectionHeader() },
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
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      return edit.rowId;
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    const { edit } = validEdits[i]!;
    if (result.status === "fulfilled") {
      succeeded.push(edit.rowId);
    } else {
      failed.push({
        rowId: edit.rowId,
        error: result.reason instanceof Error ? result.reason.message : "Network error",
      });
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
