"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  SpinnerGap,
  Warning,
  Trash,
  PencilSimple,
  Plus,
  Rocket,
  ArrowsDownUp,
  ShieldCheck,
} from "@phosphor-icons/react";

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
  onExecuted?: (success: boolean) => void;
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

function ActionIcon({ action, className }: { action: CmsAction; className?: string }) {
  switch (action.action) {
    case "add_items":
    case "add_enum_case":
      return <Plus className={className} weight="bold" />;
    case "remove_item":
    case "remove_items":
    case "remove_enum_case":
      return <Trash className={className} weight="fill" />;
    case "set_item_attributes":
    case "update_enum_case":
      return <PencilSimple className={className} weight="fill" />;
    case "set_enum_case_order":
      return <ArrowsDownUp className={className} weight="bold" />;
    case "publish":
      return <Rocket className={className} weight="fill" />;
  }
}

/** Render a compact summary of what the action will do */
function ActionDetails({ action }: { action: CmsAction }) {
  switch (action.action) {
    case "add_items":
      return (
        <div className="flex flex-col gap-1 text-[11px] text-fresco-description">
          {action.items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="font-mono text-fresco-title">{item.slug}</span>
              {item.draft !== false && (
                <span className="rounded bg-fresco-divider px-1 py-0.5 text-[9px]">Draft</span>
              )}
            </div>
          ))}
          {action.items.length > 5 && (
            <span className="text-[10px]">+{action.items.length - 5} more</span>
          )}
        </div>
      );
    case "remove_items":
      return (
        <span className="text-[11px] text-fresco-description">
          {action.itemIds.length} item{action.itemIds.length !== 1 ? "s" : ""} will be permanently removed
        </span>
      );
    case "remove_item":
      return (
        <span className="text-[11px] text-fresco-description">
          This item will be permanently removed
        </span>
      );
    case "set_item_attributes": {
      const changes: string[] = [];
      if (action.slug) changes.push(`slug → ${action.slug}`);
      if (action.draft !== undefined) changes.push(action.draft ? "Set as draft" : "Publish");
      if (action.fieldData) changes.push(`${Object.keys(action.fieldData).length} field${Object.keys(action.fieldData).length !== 1 ? "s" : ""}`);
      return (
        <span className="text-[11px] text-fresco-description">
          {changes.join(" · ") || "No changes specified"}
        </span>
      );
    }
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

export function CmsActionConfirmation({ proposal, onExecuted }: CmsActionConfirmationProps) {
  const [state, setState] = useState<"pending" | "executing" | "approved" | "rejected" | "failed">("pending");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const severity = getActionSeverity(proposal.payload);
  const styles = severityStyles(severity);
  const label = getActionLabel(proposal.payload);
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
        ? "The proposed action was not executed."
        : proposal.description;
  const metaText =
    state === "pending"
      ? "Approval is required before Framer is changed."
      : state === "executing"
        ? "Applying this change in Framer."
        : state === "approved"
          ? "Framer was updated successfully."
          : state === "rejected"
            ? "No CMS changes were made."
            : "The action could not be completed.";
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

  async function handleApprove() {
    setState("executing");
    try {
      const res = await fetch("/api/ai/cms-action/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal.payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setState("approved");
      onExecuted?.(true);
    } catch (err) {
      setState("failed");
      setErrorMsg(err instanceof Error ? err.message : "Execution failed");
      onExecuted?.(false);
    }
  }

  function handleReject() {
    setState("rejected");
    onExecuted?.(false);
  }

  return (
    <ToolCallRow
      elevated
      icon={headerIcon}
      label={label}
      meta={metaText}
      shimmer={state === "executing"}
      status={statusLabel}
      summary={summaryText}
      tone={stateTone}
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-fresco-divider/80 bg-fresco-panel/70 px-3 py-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fresco-subtitle">
            Review change
          </div>
          <div className="flex items-start gap-2.5">
            <ActionIcon action={proposal.payload} className={`mt-0.5 size-4 shrink-0 ${styles.iconColor}`} />
            <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-fresco-description">
              <ActionDetails action={proposal.payload} />
            </div>
          </div>
        </div>

        {state === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={styles.buttonVariant}
              className="flex-1 gap-1.5"
              onClick={handleApprove}
            >
              <CheckCircle className="size-3.5" weight="bold" />
              {severity === "destructive" ? "Approve removal" : severity === "warning" ? "Approve publish" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={handleReject}
            >
              <XCircle className="size-3.5" weight="bold" />
              Reject
            </Button>
          </div>
        )}

        {state === "failed" && (
          <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={handleApprove}>
            Retry
          </Button>
        )}
      </div>
    </ToolCallRow>
  );
}
