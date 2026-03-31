"use client";

import {
  CheckCircle,
  XCircle,
  SpinnerGap,
  Warning,
  ShieldCheck,
  Eye,
  Plus,
  Pencil,
  Trash,
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
import {
  summarizeValidationIssues,
  validateAddItemsAgainstMetadata,
} from "@/lib/cms-action-validation";
import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  DashboardFieldValue,
} from "@/lib/cms-types";
import { cn } from "@/lib/utils";

interface CmsActionConfirmationProps {
  proposal: CmsActionProposal;
  state?: string;
  output?: unknown;
  fieldNames?: Record<string, string>;
  metadata?: BlogCollectionMetadata;
  onApprove?: () => void;
  onReject?: () => void;
  onPreviewItem?: (post: BlogPostRecord) => void;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ draft }: { draft?: boolean }) {
  // AI-created items are always staged first
  return (
    <Badge
      variant="secondary"
      className="h-5 rounded px-1.5 text-[10px] font-medium bg-fresco-success/15 text-fresco-success border-fresco-success/25"
    >
      Staged
    </Badge>
  );
}

/** Build a synthetic BlogPostRecord from an add_items proposal item */
export function buildSyntheticPost(
  item: { id?: string; slug: string; draft?: boolean; fieldData?: Record<string, { type: string; value: unknown }> },
  fieldNames?: Record<string, string>,
): BlogPostRecord {
  const fieldValues: Record<string, DashboardFieldValue> = {};
  let title = item.slug;

  if (item.fieldData) {
    for (const [key, entry] of Object.entries(item.fieldData)) {
      if (!entry) continue;
      fieldValues[key] = entry.value as DashboardFieldValue;
      if ((fieldNames?.[key] ?? key).toLowerCase().includes("title") && typeof entry.value === "string") {
        title = entry.value;
      }
    }
  }

  return {
    id: item.id ?? `preview-${item.slug}`,
    slug: item.slug,
    draft: item.draft ?? true,
    title,
    date: null,
    createdAt: null,
    lastUpdated: null,
    lastUpdatedBy: null,
    fieldValues,
  };
}

/** Build a synthetic BlogPostRecord from a set_item_attributes action */
export function buildSyntheticPostFromUpdate(
  action: CmsAction & { action: "set_item_attributes" },
  fieldNames?: Record<string, string>,
): BlogPostRecord {
  const fieldValues: Record<string, DashboardFieldValue> = {};
  let title = action.itemId;

  if (action.fieldData) {
    for (const [key, entry] of Object.entries(action.fieldData)) {
      if (!entry) continue;
      fieldValues[key] = entry.value as DashboardFieldValue;
      if ((fieldNames?.[key] ?? key).toLowerCase().includes("title") && typeof entry.value === "string") {
        title = entry.value;
      }
    }
  }

  return {
    id: action.itemId,
    slug: action.slug ?? action.itemId,
    draft: action.draft ?? false,
    title,
    date: null,
    createdAt: null,
    lastUpdated: null,
    lastUpdatedBy: null,
    fieldValues,
  };
}

// ---------------------------------------------------------------------------
// Clickable item row for add_items
// ---------------------------------------------------------------------------

function AddItemRow({
  item,
  index,
  fieldNames,
  onPreview,
}: {
  item: { id?: string; slug: string; draft?: boolean; fieldData?: Record<string, { type: string; value: unknown }> };
  index: number;
  fieldNames?: Record<string, string>;
  onPreview: (post: BlogPostRecord) => void;
}) {
  const fieldEntries = item.fieldData ? Object.entries(item.fieldData) : [];
  const titleField = fieldEntries.find(
    ([key, entry]) => entry != null && (fieldNames?.[key] ?? key).toLowerCase().includes("title") &&
      typeof entry.value === "string",
  );
  const displayTitle = titleField?.[1] ? String(titleField[1].value) : item.slug;

  const summaryFields = fieldEntries
    .filter(([key, entry]) => entry != null && key !== titleField?.[0])
    .slice(0, 2);
  const summaryText = summaryFields
    .map(([key, entry]) => {
      const label = fieldNames?.[key] ?? key;
      const val = entry?.value;
      const short = typeof val === "string" && val.length > 30 ? val.slice(0, 30) + "…" : String(val ?? "");
      return `${label}: ${short}`;
    })
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onPreview(buildSyntheticPost(item, fieldNames))}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        "hover:bg-fresco-surface-subtle cursor-pointer",
        index > 0 && "border-t border-fresco-divider/60",
      )}
    >
      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-fresco-tint-dimmed text-fresco-tint">
        <Plus className="size-3" weight="bold" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-fresco-title">
            {displayTitle}
          </span>
          <StatusBadge draft={item.draft} />
        </div>
        {summaryText ? (
          <span className="block truncate text-[11px] text-fresco-subtitle">{summaryText}</span>
        ) : (
          <span className="text-[11px] text-fresco-subtitle font-mono">/{item.slug}</span>
        )}
      </div>
      <Eye className="size-3.5 shrink-0 text-fresco-subtitle" weight="bold" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Clickable row for set_item_attributes (update)
// ---------------------------------------------------------------------------

function UpdateItemRow({
  action,
  fieldNames,
  onPreview,
}: {
  action: CmsAction & { action: "set_item_attributes" };
  fieldNames?: Record<string, string>;
  onPreview: (post: BlogPostRecord) => void;
}) {
  const changes: Array<{ field: string }> = [];
  if (action.slug !== undefined) changes.push({ field: "Slug" });
  if (action.draft !== undefined) changes.push({ field: "Status" });
  if (action.fieldData) {
    for (const [key] of Object.entries(action.fieldData)) {
      changes.push({ field: fieldNames?.[key] ?? key });
    }
  }

  if (changes.length === 0) {
    return <span className="text-[11px] text-fresco-description italic px-3 py-2">No changes specified</span>;
  }

  const summary = changes.map((c) => c.field).join(", ");

  return (
    <button
      type="button"
      onClick={() => onPreview(buildSyntheticPostFromUpdate(action, fieldNames))}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        "hover:bg-fresco-surface-subtle cursor-pointer",
      )}
    >
      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-fresco-warning-callout-bg text-fresco-warning">
        <Pencil className="size-3" weight="bold" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium text-fresco-title">Update item</span>
        <span className="block truncate text-[11px] text-fresco-subtitle">{summary}</span>
      </div>
      <Eye className="size-3.5 shrink-0 text-fresco-subtitle" weight="bold" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Remove items list (no preview)
// ---------------------------------------------------------------------------

function RemoveItemsList({ itemIds }: { itemIds: string[] }) {
  return (
    <div className="flex flex-col">
      {itemIds.map((id, i) => (
        <div
          key={id}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5",
            i > 0 && "border-t border-fresco-divider/60",
          )}
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-fresco-danger-callout-bg text-fresco-error">
            <Trash className="size-3" weight="bold" />
          </div>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fresco-title">{id}</span>
          <Badge
            variant="outline"
            className="h-5 shrink-0 rounded px-1.5 text-[10px] font-medium text-fresco-error border-fresco-error/25"
          >
            Remove
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enum + publish details
// ---------------------------------------------------------------------------

function SimpleActionDetail({ action }: { action: CmsAction }) {
  switch (action.action) {
    case "add_enum_case":
      return (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-[12px] text-fresco-description">
            New option: <span className="font-medium text-fresco-title">{action.name}</span>
          </span>
        </div>
      );
    case "update_enum_case":
      return (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-[12px] text-fresco-description">
            Rename to: <span className="font-medium text-fresco-title">{action.newName}</span>
          </span>
        </div>
      );
    case "remove_enum_case":
      return (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-[12px] text-fresco-description">
            This enum option will be permanently removed
          </span>
        </div>
      );
    case "set_enum_case_order":
      return (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-[12px] text-fresco-description">
            {action.caseIds.length} options will be reordered
          </span>
        </div>
      );
    case "publish":
      return (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-[12px] text-fresco-description">
            A new deployment will be created for the live site
          </span>
        </div>
      );
    case "push_staged_items": {
      const count = action.stagedItemIds.length;
      const target = action.draft ? "drafts" : "live";
      return (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-[12px] text-fresco-description">
            {count} staged item{count === 1 ? "" : "s"} will be pushed to Framer as {target}
          </span>
        </div>
      );
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Action details dispatcher
// ---------------------------------------------------------------------------

function ActionDetails({
  action,
  fieldNames,
  onPreview,
}: {
  action: CmsAction;
  fieldNames?: Record<string, string>;
  onPreview: (post: BlogPostRecord) => void;
}) {
  switch (action.action) {
    case "add_items":
      return (
        <div className="flex flex-col">
          {action.items.map((item, i) => (
            <AddItemRow key={i} item={item} index={i} fieldNames={fieldNames} onPreview={onPreview} />
          ))}
          {action.items.length > 1 && (
            <div className="flex items-center gap-1.5 border-t border-fresco-divider bg-fresco-surface-muted/50 px-3 py-2 text-[11px] text-fresco-subtitle">
              <Rows className="size-3.5" weight="bold" />
              <span>{action.items.length} items total</span>
            </div>
          )}
        </div>
      );
    case "remove_items":
      return <RemoveItemsList itemIds={action.itemIds} />;
    case "remove_item":
      return <RemoveItemsList itemIds={[action.itemId]} />;
    case "set_item_attributes":
      return <UpdateItemRow action={action} fieldNames={fieldNames} onPreview={onPreview} />;
    default:
      return <SimpleActionDetail action={action} />;
  }
}

// ---------------------------------------------------------------------------
// Visual state derivation
// ---------------------------------------------------------------------------

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
      if (sdkState === "call" || sdkState === "partial-call") return "executing";
      return "executing";
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CmsActionConfirmation({
  proposal,
  state: sdkState,
  output,
  fieldNames,
  metadata,
  onApprove,
  onReject,
  onPreviewItem,
}: CmsActionConfirmationProps) {
  const state = deriveVisualState(sdkState, output);
  const severity = getActionSeverity(proposal.payload);
  const styles = severityStyles(severity);
  const label = getActionLabel(proposal.payload);
  const addItemsValidation =
    proposal.payload.action === "add_items"
      ? validateAddItemsAgainstMetadata(proposal.payload, metadata)
      : null;
  const blockingIssues = addItemsValidation?.blockingIssues ?? [];
  const warningIssues = addItemsValidation?.warningIssues ?? [];
  const blockingSummary = summarizeValidationIssues(blockingIssues);
  const warningSummary = summarizeValidationIssues(warningIssues);
  const canApprove = blockingIssues.length === 0;

  const outputData = output as { success?: boolean; error?: string } | undefined;
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

  const itemCount =
    proposal.payload.action === "add_items"
      ? proposal.payload.items.length
      : proposal.payload.action === "remove_items"
        ? proposal.payload.itemIds.length
        : proposal.payload.action === "push_staged_items"
          ? proposal.payload.stagedItemIds.length
          : 1;

  const supportsPreview =
    onPreviewItem &&
    (proposal.payload.action === "add_items" ||
      proposal.payload.action === "set_item_attributes");

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
        {supportsPreview && (
          <div className="flex items-center gap-1.5 text-[10px] text-fresco-subtitle">
            <Eye className="size-3" weight="bold" />
            <span>Click an item to preview in the editor</span>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-fresco-divider/60">
          <ActionDetails
            action={proposal.payload}
            fieldNames={fieldNames}
            onPreview={onPreviewItem ?? (() => {})}
          />
        </div>

        {(blockingIssues.length > 0 || warningIssues.length > 0) && (
          <div className="rounded-lg border border-fresco-warning/30 bg-fresco-warning-callout-bg px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Warning className="mt-0.5 size-3.5 shrink-0 text-fresco-warning" weight="fill" />
              <div className="min-w-0 flex-1">
                {blockingIssues.length > 0 && (
                  <>
                    <p className="text-[12px] font-medium text-fresco-warning-callout-text">
                      This proposal is incomplete.
                    </p>
                    <div className="mt-1 flex flex-col gap-1">
                      {blockingSummary.map((issue) => (
                        <span
                          key={issue.key}
                          className="text-[11px] text-fresco-warning-callout-text"
                        >
                          <span className="font-medium">{issue.label}</span>: {issue.message}
                        </span>
                      ))}
                      {blockingIssues.length > blockingSummary.length && (
                        <span className="text-[11px] text-fresco-warning-callout-text">
                          {blockingIssues.length - blockingSummary.length} more required-field issues hidden.
                        </span>
                      )}
                    </div>
                  </>
                )}

                {warningIssues.length > 0 && (
                  <div className={cn("flex flex-col gap-1", blockingIssues.length > 0 && "mt-2")}>
                    <p className="text-[12px] font-medium text-fresco-warning-callout-text">
                      Thumbnail still missing.
                    </p>
                    {warningSummary.map((issue) => (
                      <span
                        key={issue.key}
                        className="text-[11px] text-fresco-warning-callout-text"
                      >
                        <span className="font-medium">{issue.label}</span>: {issue.message}
                      </span>
                    ))}
                    <span className="text-[11px] text-fresco-warning-callout-text/85">
                      Image fields can be applied after generation, but enum/reference/text fields must be present before approval.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {state === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={styles.buttonVariant}
              className="flex-1 gap-1.5"
              disabled={!canApprove}
              onClick={onApprove}
            >
              <CheckCircle className="size-3.5" weight="bold" />
              {!canApprove
                ? "Fix required fields first"
                : severity === "destructive"
                  ? "Approve removal"
                  : severity === "warning"
                    ? "Approve publish"
                    : itemCount > 1
                      ? `Approve all ${itemCount}`
                      : "Approve"}
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
