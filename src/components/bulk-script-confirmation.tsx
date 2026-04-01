"use client";

import {
  CaretDown,
  CheckCircle,
  XCircle,
  SpinnerGap,
  Warning,
  Terminal,
  Play,
  Prohibit,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BulkScriptProposal {
  description: string;
  script: string;
  collectionId?: string;
}

export interface BulkScriptOutput {
  success: boolean;
  logs: string[];
  result?: unknown;
  error?: string;
  durationMs: number;
}

interface BulkScriptConfirmationProps {
  proposal: BulkScriptProposal;
  state?: string;
  output?: unknown;
  onApprove?: () => void;
  onReject?: () => void;
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
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  VisualState,
  {
    label: string;
    labelClass: string;
    dotClass: string;
  }
> = {
  pending: {
    label: "REVIEW",
    labelClass: "text-amber-500",
    dotClass: "bg-amber-500",
  },
  executing: {
    label: "RUNNING",
    labelClass: "text-blue-400",
    dotClass: "bg-blue-400 animate-pulse",
  },
  approved: {
    label: "DONE",
    labelClass: "text-emerald-400",
    dotClass: "bg-emerald-400",
  },
  rejected: {
    label: "REJECTED",
    labelClass: "text-neutral-500",
    dotClass: "bg-neutral-500",
  },
  failed: {
    label: "FAILED",
    labelClass: "text-red-400",
    dotClass: "bg-red-400",
  },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BulkScriptConfirmation({
  proposal,
  state: sdkState,
  output: rawOutput,
  onApprove,
  onReject,
}: BulkScriptConfirmationProps) {
  const visualState = deriveVisualState(sdkState, rawOutput);
  const output = rawOutput as BulkScriptOutput | undefined;
  const status = STATUS_CONFIG[visualState];

  const [open, setOpen] = useState(true);
  const scriptLines = proposal.script.split("\n");
  const hasLogs = output?.logs && output.logs.length > 0;
  const showLogArea = visualState === "executing" || visualState === "approved" || visualState === "failed";

  // Auto-scroll logs to bottom
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showLogArea && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [output?.logs?.length, showLogArea]);

  return (
    <div className="overflow-hidden rounded-xl border border-fresco-divider/40 bg-[color:var(--code-bg,#fafafa)] dark:bg-[color:var(--code-bg,#1e1e1e)]">
      {/* ── Header (clickable to collapse/expand) ── */}
      <button
        type="button"
        className="flex w-full items-center gap-2.5 border-b border-fresco-divider/30 px-3.5 py-2.5"
        onClick={() => setOpen((v) => !v)}
      >
        <Terminal className="size-4 shrink-0 text-fresco-subtitle" weight="bold" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-[13px] font-semibold text-fresco-title">
            Run script
          </span>
          <div className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", status.dotClass)} />
            <span className={cn("text-[10px] font-semibold tracking-wider", status.labelClass)}>
              {status.label}
            </span>
          </div>
        </div>
        <CaretDown
          className={cn(
            "size-3.5 shrink-0 text-fresco-subtitle transition-transform duration-200",
            !open && "-rotate-90",
          )}
          weight="bold"
        />
      </button>

      {/* ── Terminal body (code + logs in one continuous surface) ── */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
      <div className={cn("overflow-hidden", open && "max-h-[28rem] overflow-auto")}>
        <pre className="px-3.5 py-3 font-mono text-[11.5px] leading-[1.75]">
          {/* ── Script lines ── */}
          <div
            className={cn(
              "transition-opacity duration-300",
              (visualState === "approved" || visualState === "failed") && "opacity-50",
              visualState === "executing" && "opacity-60",
              visualState === "rejected" && "opacity-30",
            )}
          >
            {scriptLines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all text-fresco-title/80">
                {line || "\u200b"}
              </div>
            ))}
          </div>

          {/* ── Dashed separator + output ── */}
          {showLogArea && (
            <>
              <div className="my-2 border-t border-dashed border-fresco-divider/30" />

              {hasLogs ? (
                output!.logs.map((line, i) => (
                  <div
                    key={`log-${i}`}
                    className={cn(
                      "whitespace-pre-wrap break-all text-fresco-description",
                      line.startsWith("[ERR]") && "text-red-500 dark:text-red-400",
                      line.startsWith("[WARN]") && "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {line}
                  </div>
                ))
              ) : visualState === "executing" ? (
                <div className="flex items-center gap-2 text-fresco-subtitle">
                  <SpinnerGap className="size-3 animate-spin" weight="bold" />
                  <span>Executing...</span>
                </div>
              ) : null}

              {/* Result line */}
              {visualState === "approved" && output?.durationMs !== undefined && (
                <div className="mt-1.5 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="size-3.5" weight="bold" />
                  <span>Completed in {(output.durationMs / 1000).toFixed(1)}s</span>
                </div>
              )}

              {visualState === "failed" && output?.error && (
                <div className="mt-1.5 flex items-start gap-1.5 text-red-500 dark:text-red-400">
                  <Warning className="mt-0.5 size-3.5 shrink-0" weight="bold" />
                  <span className="min-w-0 whitespace-pre-wrap">{output.error}</span>
                </div>
              )}

              <div ref={logEndRef} />
            </>
          )}
        </pre>
      </div>
      </div>

      {/* ── Rejected message ── */}
      {open && visualState === "rejected" && (
        <div className="flex items-center gap-2 border-t border-dashed border-fresco-divider/40 px-3.5 py-2.5 font-mono text-[11px] text-fresco-subtitle">
          <Prohibit className="size-3.5" weight="bold" />
          <span>Not executed.</span>
        </div>
      )}

      {/* ── Approve / Reject ── */}
      {open && visualState === "pending" && (
        <div className="flex items-center gap-2 border-t border-fresco-divider/30 px-3.5 py-2.5">
          <Button
            size="sm"
            variant="default"
            className="flex-1 gap-1.5"
            onClick={onApprove}
          >
            <Play className="size-3.5" weight="fill" />
            Run
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
  );
}
