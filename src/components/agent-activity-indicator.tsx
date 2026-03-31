"use client";

import {
  ArrowClockwise,
  CircleNotch,
  Database,
  Lightning,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Shimmer } from "@/components/ui/shimmer";
import type { StreamLifecycle } from "@/lib/use-ai-chat-session";
import { cn } from "@/lib/utils";

const TOOL_PHASE_LABELS: Record<string, string> = {
  get_project_context: "Loading project context",
  framer_get_collections: "Fetching collections",
  framer_get_collection_fields: "Reading fields",
  framer_get_collection_items: "Fetching items",
  framer_get_enum_cases: "Loading options",
  framer_get_publish_info: "Checking publish status",
  framer_create_item: "Creating item",
  framer_update_item: "Updating item",
  framer_delete_item: "Deleting item",
  framer_publish_site: "Publishing site",
  framer_upload_asset: "Uploading asset",
  propose_cms_action: "Preparing CMS proposal",
  propose_edits: "Preparing edits",
  generate_and_upload_image: "Generating image",
  web_search: "Searching the web",
  save_preference: "Saving preference",
};

function getToolPhaseLabel(toolName: string): string {
  return (
    TOOL_PHASE_LABELS[toolName] ??
    toolName.replace(/^framer_/, "").replace(/_/g, " ")
  );
}

function formatElapsed(ms: number): string {
  if (ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type Phase =
  | "connecting"
  | "thinking"
  | "executing-tool"
  | "assembling-payload"
  | "recovering";

function detectPhase(
  lifecycle: StreamLifecycle,
  activeToolNames: string[],
): Phase {
  // Check for recent tool input error (recovery)
  if (lifecycle.toolInputErrors.length > 0) {
    const lastError =
      lifecycle.toolInputErrors[lifecycle.toolInputErrors.length - 1];
    const errorAge = Date.now() - new Date(lastError.ts).getTime();
    if (errorAge < 30_000) {
      return "recovering";
    }
  }

  // Connecting: no chunks received yet
  if (lifecycle.startedAt === null || lifecycle.lastChunkType === null) {
    return "connecting";
  }

  // Assembling payload: active tool is propose_cms_action
  if (lifecycle.activeToolName === "propose_cms_action") {
    return "assembling-payload";
  }

  // Executing a tool
  if (
    lifecycle.activeToolName ||
    (activeToolNames.length > 0 &&
      lifecycle.lastChunkType?.startsWith("tool-"))
  ) {
    return "executing-tool";
  }

  // Default: thinking
  return "thinking";
}

function getPhaseLabel(
  phase: Phase,
  lifecycle: StreamLifecycle,
  activeToolNames: string[],
  silenceMs: number,
): string {
  switch (phase) {
    case "connecting":
      return "Connecting...";
    case "recovering":
      return "Formatting issue, retrying...";
    case "assembling-payload": {
      if (silenceMs > 30_000) {
        return "CMS proposal is taking longer than expected -- stop to retry if needed";
      }
      return "Preparing CMS proposal...";
    }
    case "executing-tool": {
      const toolLabel = lifecycle.activeToolName
        ? getToolPhaseLabel(lifecycle.activeToolName)
        : activeToolNames.length > 0
          ? activeToolNames[activeToolNames.length - 1]
          : "Running tool";
      if (silenceMs > 30_000) {
        return `${toolLabel} is taking longer than expected -- stop to retry if needed`;
      }
      return `${toolLabel}...`;
    }
    case "thinking": {
      if (silenceMs > 60_000) {
        return "This is taking a while -- stop to simplify if needed";
      }
      if (silenceMs > 15_000) {
        return "Working on a complex response...";
      }
      if (silenceMs > 5_000) {
        return "Still thinking...";
      }
      return "Thinking...";
    }
  }
}

function getPhaseIcon(phase: Phase) {
  switch (phase) {
    case "connecting":
      return <CircleNotch className="size-3.5 animate-spin" weight="bold" />;
    case "recovering":
      return (
        <ArrowClockwise className="size-3.5 animate-spin" weight="bold" />
      );
    case "assembling-payload":
      return <Database className="size-3.5 animate-pulse" weight="fill" />;
    case "executing-tool":
      return <Lightning className="size-3.5 animate-pulse" weight="fill" />;
    case "thinking":
      return <CircleNotch className="size-3.5 animate-spin" weight="bold" />;
  }
}

interface AgentActivityIndicatorProps {
  streamLifecycle: StreamLifecycle;
  activeToolNames: string[];
  isStreaming: boolean;
}

export function AgentActivityIndicator({
  streamLifecycle,
  activeToolNames,
  isStreaming,
}: AgentActivityIndicatorProps) {
  const [, setTick] = useState(0);

  // Tick every second to update elapsed timer and silence detection
  useEffect(() => {
    if (!isStreaming) return;
    const interval = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isStreaming]);

  if (!isStreaming) return null;

  const now = Date.now();
  const elapsedMs = streamLifecycle.startedAt
    ? now - streamLifecycle.startedAt
    : 0;
  const silenceMs = streamLifecycle.lastChunkAt
    ? now - streamLifecycle.lastChunkAt
    : elapsedMs;

  const phase = detectPhase(streamLifecycle, activeToolNames);
  const label = getPhaseLabel(phase, streamLifecycle, activeToolNames, silenceMs);
  const icon = getPhaseIcon(phase);
  const showElapsed = elapsedMs > 2000;
  const showSteps =
    streamLifecycle.currentStep > 1 || streamLifecycle.completedSteps > 0;

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center gap-2 text-[12px] text-fresco-subtitle">
        <span
          className={cn(
            "flex items-center justify-center",
            phase === "recovering"
              ? "text-fresco-warning"
              : "text-fresco-subtitle",
          )}
        >
          {icon}
        </span>
        <Shimmer
          as="span"
          className={cn(
            "min-w-0 flex-1 truncate",
            phase === "recovering"
              ? "text-fresco-warning-callout-text"
              : "text-fresco-subtitle",
          )}
          duration={1.8}
        >
          {label}
        </Shimmer>
        {showElapsed && (
          <span className="shrink-0 tabular-nums text-[10px] text-fresco-subtitle/70">
            {formatElapsed(elapsedMs)}
          </span>
        )}
      </div>

      {showSteps && (
        <div className="flex items-center gap-1 pl-6">
          {Array.from({ length: streamLifecycle.currentStep }).map((_, i) => {
            const isCompleted = i < streamLifecycle.completedSteps;
            const isCurrent =
              i === streamLifecycle.completedSteps &&
              i < streamLifecycle.currentStep;
            return (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full transition-all duration-300",
                  isCompleted
                    ? "bg-fresco-tint"
                    : isCurrent
                      ? "bg-fresco-tint/50 animate-pulse"
                      : "bg-fresco-divider",
                )}
              />
            );
          })}
          <span className="ml-1 text-[10px] text-fresco-subtitle/60">
            Step {Math.min(streamLifecycle.completedSteps + 1, streamLifecycle.currentStep)} of{" "}
            {streamLifecycle.currentStep}
          </span>
        </div>
      )}
    </div>
  );
}
