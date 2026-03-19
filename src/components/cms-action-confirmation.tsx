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
        border: "border-red-500/30",
        bg: "bg-red-500/5",
        iconColor: "text-red-400",
        buttonVariant: "destructive" as const,
      };
    case "warning":
      return {
        border: "border-amber-500/30",
        bg: "bg-amber-500/5",
        iconColor: "text-amber-400",
        buttonVariant: "default" as const,
      };
    default:
      return {
        border: "border-[var(--framer-fresco-panelDivider-color)]",
        bg: "bg-[var(--framer-app-surface-muted-color)]",
        iconColor: "text-[color:var(--framer-fresco-tint-color)]",
        buttonVariant: "default" as const,
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
        <div className="flex flex-col gap-1 text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
          {action.items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="font-mono text-[color:var(--framer-fresco-panelTitle-color)]">{item.slug}</span>
              {item.draft !== false && (
                <span className="rounded bg-[var(--framer-fresco-panelDivider-color)] px-1 py-0.5 text-[9px]">Draft</span>
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
        <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
          {action.itemIds.length} item{action.itemIds.length !== 1 ? "s" : ""} will be permanently removed
        </span>
      );
    case "remove_item":
      return (
        <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
          This item will be permanently removed
        </span>
      );
    case "set_item_attributes": {
      const changes: string[] = [];
      if (action.slug) changes.push(`slug → ${action.slug}`);
      if (action.draft !== undefined) changes.push(action.draft ? "Set as draft" : "Publish");
      if (action.fieldData) changes.push(`${Object.keys(action.fieldData).length} field${Object.keys(action.fieldData).length !== 1 ? "s" : ""}`);
      return (
        <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
          {changes.join(" · ") || "No changes specified"}
        </span>
      );
    }
    case "add_enum_case":
      return (
        <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
          New option: <span className="font-medium text-[color:var(--framer-fresco-panelTitle-color)]">{action.name}</span>
        </span>
      );
    case "update_enum_case":
      return (
        <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
          Rename to: <span className="font-medium text-[color:var(--framer-fresco-panelTitle-color)]">{action.newName}</span>
        </span>
      );
    case "remove_enum_case":
      return (
        <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
          This enum option will be permanently removed
        </span>
      );
    case "set_enum_case_order":
      return (
        <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
          {action.caseIds.length} options will be reordered
        </span>
      );
    case "publish":
      return (
        <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
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
    <div className={`flex flex-col gap-2.5 rounded-lg border ${styles.border} ${styles.bg} p-3`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck className={`size-4 shrink-0 ${styles.iconColor}`} weight="fill" />
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
          Confirmation Required
        </span>
      </div>

      {/* Action summary */}
      <div className="flex items-start gap-2.5 rounded-md border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] px-3 py-2.5">
        <ActionIcon action={proposal.payload} className={`mt-0.5 size-4 shrink-0 ${styles.iconColor}`} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
            {label}
          </span>
          <span className="text-[11px] leading-relaxed text-[color:var(--framer-fresco-panelDescription-color)]">
            {proposal.description}
          </span>
          <ActionDetails action={proposal.payload} />
        </div>
      </div>

      {/* Buttons */}
      {state === "pending" && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={styles.buttonVariant}
            className="flex-1 gap-1.5"
            onClick={handleApprove}
          >
            <CheckCircle className="size-3.5" weight="bold" />
            Approve
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

      {/* Executing */}
      {state === "executing" && (
        <div className="flex items-center gap-2 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
          <SpinnerGap className="size-3.5 animate-spin" />
          <span>Executing…</span>
        </div>
      )}

      {/* Approved */}
      {state === "approved" && (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle className="size-3.5" weight="fill" />
          <span>Done</span>
        </div>
      )}

      {/* Rejected */}
      {state === "rejected" && (
        <div className="flex items-center gap-2 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
          <XCircle className="size-3.5" weight="fill" />
          <span>Rejected by user</span>
        </div>
      )}

      {/* Failed */}
      {state === "failed" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <Warning className="size-3.5" weight="fill" />
            <span>{errorMsg ?? "Execution failed"}</span>
          </div>
          <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={handleApprove}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
