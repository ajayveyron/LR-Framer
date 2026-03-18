"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  SpinnerGap,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import type { BlogPostRecord } from "@/lib/cms-types";
import type { ProposedEdit } from "@/lib/ai-edit-parser";
import { applyBulkEdits, type BulkApplyResult } from "@/lib/ai-bulk-apply";

interface EditProposalViewProps {
  edits: ProposedEdit[];
  posts: BlogPostRecord[];
  onApplied: (result: BulkApplyResult) => void;
}

function truncate(value: unknown, max = 80): string {
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
  onApplied,
}: EditProposalViewProps) {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<BulkApplyResult | null>(null);
  const postMap = new Map(posts.map((p) => [p.id, p]));

  async function handleApply() {
    setApplying(true);
    try {
      const res = await applyBulkEdits(edits, posts);
      setResult(res);
      onApplied(res);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] p-3">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
        Proposed Changes — {edits.length} row{edits.length === 1 ? "" : "s"}
      </span>

      <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
        {edits.map((edit) => {
          const post = postMap.get(edit.rowId);
          const title = post?.title ?? edit.rowId;
          const rowStatus = result
            ? result.succeeded.includes(edit.rowId)
              ? "success"
              : result.failed.find((f) => f.rowId === edit.rowId)
                ? "failed"
                : "pending"
            : "pending";

          return (
            <div
              key={edit.rowId}
              className="flex flex-col gap-1.5 rounded-md border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] p-2.5"
            >
              <div className="flex items-center gap-2">
                {rowStatus === "success" && (
                  <CheckCircle
                    className="size-4 shrink-0 text-emerald-400"
                    weight="fill"
                  />
                )}
                {rowStatus === "failed" && (
                  <XCircle
                    className="size-4 shrink-0 text-red-400"
                    weight="fill"
                  />
                )}
                <span className="truncate text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
                  {title}
                </span>
              </div>

              {Object.entries(edit.changes).map(([fieldId, change]) => (
                <div
                  key={fieldId}
                  className="flex flex-wrap items-baseline gap-1.5 pl-6 text-xs text-[color:var(--framer-fresco-panelDescription-color)]"
                >
                  <span className="font-medium text-[color:var(--framer-fresco-panelSubtitle-color)]">
                    {change.fieldName}
                  </span>
                  <span className="truncate opacity-60">
                    {truncate(change.currentValue)}
                  </span>
                  <ArrowRight className="size-3 shrink-0 opacity-40" />
                  <span className="truncate text-[color:var(--framer-fresco-panelTitle-color)]">
                    {truncate(change.proposedValue)}
                  </span>
                </div>
              ))}

              {rowStatus === "failed" && (
                <span className="pl-6 text-xs text-red-400">
                  {result?.failed.find((f) => f.rowId === edit.rowId)?.error}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!result && (
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
            `Apply ${edits.length} Change${edits.length === 1 ? "" : "s"}`
          )}
        </Button>
      )}

      {result && (
        <div className="text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
          {result.succeeded.length} applied
          {result.failed.length > 0 &&
            `, ${result.failed.length} failed`}
        </div>
      )}
    </div>
  );
}
