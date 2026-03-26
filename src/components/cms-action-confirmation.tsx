"use client";

import {
  CheckCircle,
  XCircle,
  SpinnerGap,
  Warning,
  ShieldCheck,
  Rows,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { ToolCallRow, type ToolTone } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import type {
  CmsAction,
  CmsActionProposal,
} from "@/lib/cms-action-types";
import {
  getActionSeverity,
  getActionLabel,
  type ActionSeverity,
} from "@/lib/cms-action-types";

interface CmsActionConfirmationProps {
  proposal: CmsActionProposal;
  /** SDK tool invocation state */
  state?: string;
  /** Tool execute result (available after approval + execution) */
  output?: unknown;
  /** Map of field ID → human-readable name for table column headers */
  fieldNames?: Record<string, string>;
  onApprove?: () => void;
  onReject?: () => void;
}

function severityStyles(severity: ActionSeverity) {
  switch (severity) {
    case "destructive":
      return {
        iconColor: "text-red-400",
        buttonVariant: "destructive" as const,
        tone: "danger" as ToolTone,
      };
    case "warning":
      return {
        iconColor: "text-amber-400",
        buttonVariant: "default" as const,
        tone: "warning" as ToolTone,
      };
    default:
      return {
        iconColor: "text-fresco-tint",
        buttonVariant: "default" as const,
        tone: "accent" as ToolTone,
      };
  }
}

function truncateValue(val: unknown, max = 36): string {
  if (val == null) return "—";
  const s = String(val);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** Table for add_items — shows slug, status, and a few field values. */
function AddItemsTable({ items, fieldNames }: { items: Array<{ id?: string; slug: string; draft?: boolean; fieldData?: Record<string, { type: string; value: unknown }> }>; fieldNames?: Record<string, string> }) {
  const MAX_ROWS = 6;
  const visible = items.slice(0, MAX_ROWS);
  const overflow = items.length - MAX_ROWS;

  // Collect field columns from all items
  const colSet = new Set<string>();
  for (const item of visible) {
    if (item.fieldData) {
      for (const key of Object.keys(item.fieldData)) {
        colSet.add(key);
        if (colSet.size >= 3) break;
      }
    }
    if (colSet.size >= 3) break;
  }
  const fieldCols = [...colSet];

  return (
    <div className="overflow-hidden rounded-lg border border-fresco-divider">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-fresco-divider bg-fresco-surface-muted">
              <th className="px-3 py-2 text-left font-medium text-fresco-subtitle">Slug</th>
              <th className="px-3 py-2 text-left font-medium text-fresco-subtitle">Status</th>
              {fieldCols.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium text-fresco-subtitle">
                  {fieldNames?.[col] ?? col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item, i) => (
              <tr key={i} className="border-b border-fresco-divider last:border-b-0">
                <td className="max-w-[140px] truncate px-3 py-2 font-mono text-fresco-title">
                  {item.slug}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant={item.draft !== false ? "outline" : "secondary"}
                    className="h-5 rounded px-1.5 text-[10px] font-medium"
                  >
                    {item.draft !== false ? "Draft" : "Published"}
                  </Badge>
                </td>
                {fieldCols.map((col) => (
                  <td key={col} className="max-w-[140px] truncate px-3 py-2 text-fresco-description">
                    {truncateValue(item.fieldData?.[col]?.value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overflow > 0 && (
        <div className="border-t border-fresco-divider bg-fresco-surface-muted px-3 py-2 text-center text-[11px] text-fresco-subtitle">
          +{overflow} more item{overflow !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

/** Table for remove_items — shows item IDs in a compact table. */
function RemoveItemsTable({ itemIds }: { itemIds: string[] }) {
  const MAX_ROWS = 6;
  const visible = itemIds.slice(0, MAX_ROWS);
  const overflow = itemIds.length - MAX_ROWS;

  return (
    <div className="overflow-hidden rounded-lg border border-fresco-divider">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-fresco-divider bg-fresco-surface-muted">
              <th className="px-3 py-2 text-left font-medium text-fresco-subtitle">Item ID</th>
              <th className="px-3 py-2 text-left font-medium text-fresco-subtitle">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((id) => (
              <tr key={id} className="border-b border-fresco-divider last:border-b-0">
                <td className="max-w-[200px] truncate px-3 py-2 font-mono text-fresco-title">{id}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="h-5 rounded px-1.5 text-[10px] font-medium text-red-400 border-red-400/30">
                    Remove
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overflow > 0 && (
        <div className="border-t border-fresco-divider bg-fresco-surface-muted px-3 py-2 text-center text-[11px] text-fresco-subtitle">
          +{overflow} more item{overflow !== 1 ? "s" : ""}
        </div>
      )}
      <div className="flex items-center gap-1.5 border-t border-fresco-divider bg-fresco-surface-muted px-3 py-2 text-[11px] text-fresco-subtitle">
        <Rows className="size-3.5" weight="bold" />
        <span>{itemIds.length} item{itemIds.length !== 1 ? "s" : ""} to remove</span>
      </div>
    </div>
  );
}

/** Table for set_item_attributes — shows field-by-field changes. */
function UpdateItemTable({ action, fieldNames }: { action: CmsAction & { action: "set_item_attributes" }; fieldNames?: Record<string, string> }) {
  const rows: Array<{ field: string; value: string }> = [];
  if (action.slug !== undefined) rows.push({ field: "Slug", value: action.slug });
  if (action.draft !== undefined) rows.push({ field: "Status", value: action.draft ? "Draft" : "Published" });
  if (action.fieldData) {
    for (const [key, entry] of Object.entries(action.fieldData)) {
      rows.push({ field: fieldNames?.[key] ?? key, value: truncateValue(entry.value) });
    }
  }

  if (rows.length === 0) {
    return <span className="text-[11px] text-fresco-description">No changes specified</span>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-fresco-divider">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-fresco-divider bg-fresco-surface-muted">
              <th className="px-3 py-2 text-left font-medium text-fresco-subtitle">Field</th>
              <th className="px-3 py-2 text-left font-medium text-fresco-subtitle">New value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field} className="border-b border-fresco-divider last:border-b-0">
                <td className="px-3 py-2 font-medium text-fresco-title">{row.field}</td>
                <td className="max-w-[200px] truncate px-3 py-2 text-fresco-description">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1.5 border-t border-fresco-divider bg-fresco-surface-muted px-3 py-2 text-[11px] text-fresco-subtitle">
        <Rows className="size-3.5" weight="bold" />
        <span>{rows.length} change{rows.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

/** Render a compact summary of what the action will do */
function ActionDetails({ action, fieldNames }: { action: CmsAction; fieldNames?: Record<string, string> }) {
  switch (action.action) {
    case "add_items":
      return <AddItemsTable items={action.items} fieldNames={fieldNames} />;
    case "remove_items":
      return <RemoveItemsTable itemIds={action.itemIds} />;
    case "remove_item":
      return <RemoveItemsTable itemIds={[action.itemId]} />;
    case "set_item_attributes":
      return <UpdateItemTable action={action} fieldNames={fieldNames} />;
    case "add_enum_case":
      return (
        <span className="text-[11px] text-fresco-description">
          New option: <span className="font-medium text-fresco-title">{action.name}</span>
        </span>
      );
    case "update_enum_case":
      return (
        <span className="text-[11px] text-fresco-description">
          Rename to: <span className="font-medium text-fresco-title">{action.newName}</span>
        </span>
      );
    case "remove_enum_case":
      return (
        <span className="text-[11px] text-fresco-description">
          This enum option will be permanently removed
        </span>
      );
    case "set_enum_case_order":
      return (
        <span className="text-[11px] text-fresco-description">
          {action.caseIds.length} options will be reordered
        </span>
      );
    case "publish":
      return (
        <span className="text-[11px] text-fresco-description">
          A new deployment will be created for the live site
        </span>
      );
  }
}

type VisualState = "pending" | "executing" | "approved" | "rejected" | "failed";

function deriveVisualState(sdkState?: string, output?: unknown): VisualState {
  switch (sdkState) {
    case "approval-requested":
    case "approval-pending":
      return "pending";
    case "approval-denied":
    case "output-denied":
      return "rejected";
    case "output-available": {
      const out = output as { success?: boolean } | undefined;
      return out?.success === false ? "failed" : "approved";
    }
    case "output-error":
      return "failed";
    default:
      // Tool is executing (approved, waiting for server execute to finish)
      if (sdkState === "call" || sdkState === "partial-call") return "executing";
      return "executing";
  }
}

export function CmsActionConfirmation({
  proposal,
  state: sdkState,
  output,
  fieldNames,
  onApprove,
  onReject,
}: CmsActionConfirmationProps) {
  const state = deriveVisualState(sdkState, output);
  const severity = getActionSeverity(proposal.payload);
  const styles = severityStyles(severity);
  const label = getActionLabel(proposal.payload);

  const outputData = output as { success?: boolean; error?: string; items?: Array<{ slug: string; draft: boolean }> } | undefined;
  const errorMsg = outputData?.success === false ? outputData.error : null;

  const stateTone: ToolTone =
    state === "approved"
      ? "success"
      : state === "failed"
        ? "danger"
        : state === "rejected"
          ? "neutral"
          : styles.tone;
  const statusLabel =
    state === "pending"
      ? "Needs approval"
      : state === "executing"
        ? "Running"
        : state === "approved"
          ? "Done"
          : state === "rejected"
            ? "Rejected"
            : "Error";
  const summaryText =
    state === "failed"
      ? errorMsg ?? "Execution failed"
      : state === "rejected"
        ? "Not executed."
        : undefined;
  const headerIcon =
    state === "approved" ? (
      <CheckCircle className="size-3.5" weight="fill" />
    ) : state === "executing" ? (
      <SpinnerGap className="size-3.5 animate-spin" />
    ) : state === "rejected" ? (
      <XCircle className="size-3.5" weight="fill" />
    ) : state === "failed" ? (
      <Warning className="size-3.5" weight="fill" />
    ) : (
      <ShieldCheck className="size-3.5" weight="fill" />
    );

  return (
    <ToolCallRow
      elevated
      icon={headerIcon}
      label={label}
      shimmer={state === "executing"}
      status={statusLabel}
      summary={summaryText}
      tone={stateTone}
    >
      <div className="flex flex-col gap-3">
        <ActionDetails action={proposal.payload} fieldNames={fieldNames} />

        {state === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={styles.buttonVariant}
              className="flex-1 gap-1.5"
              onClick={onApprove}
            >
              <CheckCircle className="size-3.5" weight="bold" />
              {severity === "destructive" ? "Approve removal" : severity === "warning" ? "Approve publish" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={onReject}
            >
              <XCircle className="size-3.5" weight="bold" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </ToolCallRow>
  );
}
