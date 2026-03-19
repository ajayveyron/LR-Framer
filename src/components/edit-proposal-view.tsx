"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  X,
  SpinnerGap,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import type {
  BlogPostRecord,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";
import type { ProposedEdit } from "@/lib/ai-edit-parser";
import { applyBulkEdits, type BulkApplyResult } from "@/lib/ai-bulk-apply";

interface EditProposalViewProps {
  edits: ProposedEdit[];
  posts: BlogPostRecord[];
  fieldDefinitions: DashboardFieldDefinition[];
  onApplied: (result: BulkApplyResult) => void;
}

function truncate(value: unknown, max = 60): string {
  const str =
    value === null || value === undefined
      ? "—"
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

export function EditProposalView({
  edits,
  posts,
  fieldDefinitions,
  onApplied,
}: EditProposalViewProps) {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<BulkApplyResult | null>(null);
  const [fetchedTitles, setFetchedTitles] = useState<Record<string, string>>({});
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const fieldMap = new Map(fieldDefinitions.map((f) => [f.id, f]));

  // Fetch titles for rows not in the local selection
  useEffect(() => {
    const missingIds = edits
      .map((e) => e.rowId)
      .filter((id) => !postMap.has(id) && !fetchedTitles[id]);
    if (missingIds.length === 0) return;

    let cancelled = false;
    Promise.allSettled(
      missingIds.map(async (id) => {
        const res = await fetch(`/api/posts/${id}`);
        if (!res.ok) return { id, title: id };
        const data = (await res.json()) as { post?: { title?: string } };
        return { id, title: data.post?.title ?? id };
      }),
    ).then((results) => {
      if (cancelled) return;
      const titles: Record<string, string> = {};
      for (const r of results) {
        if (r.status === "fulfilled") titles[r.value.id] = r.value.title;
      }
      setFetchedTitles((prev) => ({ ...prev, ...titles }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits]);

  // Check if a proposed value actually differs from the current value
  function isRealChange(post: BlogPostRecord | undefined, fieldId: string, newValue: DashboardFieldValue): boolean {
    const currentValue = post?.fieldValues[fieldId] ?? null;
    // Simple equality — stringify handles nested arrays/objects
    return JSON.stringify(currentValue) !== JSON.stringify(newValue);
  }

  // Filter edits to only those with at least one real change
  const effectiveEdits = useMemo(() => {
    const filtered: ProposedEdit[] = [];
    for (const edit of edits) {
      const post = postMap.get(edit.rowId);
      const realChanges: Record<string, DashboardFieldValue> = {};
      for (const [fieldId, newValue] of Object.entries(edit.changes)) {
        if (isRealChange(post, fieldId, newValue)) {
          realChanges[fieldId] = newValue;
        }
      }
      if (Object.keys(realChanges).length > 0) {
        filtered.push({ rowId: edit.rowId, changes: realChanges });
      }
    }
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, posts]);

  const allUpToDate = effectiveEdits.length === 0;

  // Collect all unique field IDs across every edit (use original edits for display)
  const changedFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const edit of edits) {
      for (const fieldId of Object.keys(edit.changes)) {
        ids.add(fieldId);
      }
    }
    return Array.from(ids);
  }, [edits]);

  async function handleApply() {
    setApplying(true);
    try {
      const res = await applyBulkEdits(effectiveEdits, posts);
      setResult(res);
      onApplied(res);
    } finally {
      setApplying(false);
    }
  }

  function rowStatus(rowId: string) {
    if (!result) return "pending";
    if (result.succeeded.includes(rowId)) return "success";
    if (result.failed.find((f) => f.rowId === rowId)) return "failed";
    return "pending";
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] p-3">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
        Proposed Changes — {edits.length} row{edits.length === 1 ? "" : "s"}
      </span>

      <div className="overflow-x-auto rounded-md border border-[var(--framer-fresco-panelDivider-color)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)]">
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)]">
                Post
              </th>
              {changedFieldIds.map((fieldId) => (
                <th
                  key={fieldId}
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)]"
                >
                  {fieldMap.get(fieldId)?.name ?? fieldId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {edits.map((edit) => {
              const post = postMap.get(edit.rowId);
              const title = post?.title ?? fetchedTitles[edit.rowId] ?? edit.rowId;
              const status = rowStatus(edit.rowId);

              return (
                <tr
                  key={edit.rowId}
                  className="border-b border-[var(--framer-fresco-panelDivider-color)] last:border-b-0"
                >
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5">
                      {status === "success" && (
                        <Check className="size-3.5 shrink-0 text-emerald-400" weight="bold" />
                      )}
                      {status === "failed" && (
                        <X className="size-3.5 shrink-0 text-red-400" weight="bold" />
                      )}
                      <span className="max-w-[140px] truncate font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
                        {title}
                      </span>
                    </div>
                    {status === "failed" && (
                      <span className="mt-0.5 block text-[10px] text-red-400">
                        {result?.failed.find((f) => f.rowId === edit.rowId)?.error}
                      </span>
                    )}
                  </td>
                  {changedFieldIds.map((fieldId) => {
                    const newValue = edit.changes[fieldId];
                    if (newValue === undefined) {
                      return (
                        <td
                          key={fieldId}
                          className="px-3 py-2 align-top text-[color:var(--framer-fresco-panelDescription-color)] opacity-30"
                        >
                          —
                        </td>
                      );
                    }
                    const currentValue: DashboardFieldValue = post?.fieldValues[fieldId] ?? null;
                    const unchanged = !isRealChange(post, fieldId, newValue);
                    return (
                      <td key={fieldId} className={`px-3 py-2 align-top ${unchanged ? "opacity-40" : ""}`}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[color:var(--framer-fresco-panelDescription-color)] opacity-60 line-through">
                            {truncate(currentValue)}
                          </span>
                          <span className="text-[color:var(--framer-fresco-panelTitle-color)]">
                            {truncate(newValue)}
                            {unchanged && " (no change)"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!result && !allUpToDate && (
        <Button
          className="w-full"
          disabled={applying}
          onClick={handleApply}
          size="sm"
          type="button"
        >
          {applying ? (
            <>
              <SpinnerGap className="size-4 animate-spin" />
              Applying…
            </>
          ) : (
            `Apply ${effectiveEdits.length} Change${effectiveEdits.length === 1 ? "" : "s"}`
          )}
        </Button>
      )}

      {!result && allUpToDate && (
        <div className="flex items-center gap-1.5 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
          <Check className="size-3.5 text-emerald-400" weight="bold" />
          Already up to date
        </div>
      )}

      {result && (
        <div className="text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
          {result.succeeded.length} applied
          {result.failed.length > 0 && `, ${result.failed.length} failed`}
        </div>
      )}
    </div>
  );
}
