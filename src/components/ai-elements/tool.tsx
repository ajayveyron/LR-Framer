"use client";

import {
  CheckCircle as CheckCircleIcon,
  CaretDown as ChevronDownIcon,
  Circle as CircleIcon,
  Clock as ClockIcon,
  Wrench as WrenchIcon,
  XCircle as XCircleIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn(
      // [TUNE] Tool call card wrapper — border, radius, spacing
      "group not-prose mb-4 w-full rounded-md border",
      className,
    )}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolTone =
  | "neutral"
  | "accent"
  | "warning"
  | "success"
  | "danger";

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Needs approval",
  "approval-responded": "Approved",
  "input-available": "Running",
  "input-streaming": "Running",
  "output-available": "Done",
  "output-denied": "Denied",
  "output-error": "Error",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <ClockIcon className="size-4 text-yellow-600" />,
  "approval-responded": <CheckCircleIcon className="size-4 text-blue-600" />,
  "input-available": <ClockIcon className="size-4 animate-pulse" />,
  "input-streaming": <CircleIcon className="size-4" />,
  "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
  "output-denied": <XCircleIcon className="size-4 text-orange-600" />,
  "output-error": <XCircleIcon className="size-4 text-red-600" />,
};

const toneClasses: Record<
  ToolTone,
  {
    row: string;
    icon: string;
    iconFrame: string;
    status: string;
  }
> = {
  neutral: {
    row: "bg-fresco-surface-subtle text-fresco-description",
    icon: "text-fresco-subtitle",
    iconFrame: "bg-fresco-surface-muted text-fresco-subtitle",
    status: "text-fresco-subtitle",
  },
  accent: {
    row: "bg-[color-mix(in_srgb,var(--color-fresco-tint)_10%,transparent)] text-fresco-description",
    icon: "text-fresco-tint",
    iconFrame:
      "bg-[color-mix(in_srgb,var(--color-fresco-tint)_14%,transparent)] text-fresco-tint",
    status: "text-fresco-tint",
  },
  warning: {
    row: "bg-fresco-warning-callout-bg text-fresco-warning-callout-text",
    icon: "text-fresco-warning",
    iconFrame: "bg-[color-mix(in_srgb,var(--color-fresco-warning)_16%,transparent)] text-fresco-warning",
    status: "text-fresco-warning-callout-text",
  },
  success: {
    row: "bg-fresco-success-callout-bg text-fresco-success-callout-text",
    icon: "text-fresco-success",
    iconFrame: "bg-[color-mix(in_srgb,var(--color-fresco-success)_16%,transparent)] text-fresco-success",
    status: "text-fresco-success-callout-text",
  },
  danger: {
    row: "bg-fresco-danger-callout-bg text-fresco-danger-callout-text",
    icon: "text-fresco-error",
    iconFrame: "bg-[color-mix(in_srgb,var(--color-fresco-error)_16%,transparent)] text-fresco-error",
    status: "text-fresco-danger-callout-text",
  },
};

export function getToolStateMeta(state: ToolPart["state"]): {
  label: string;
  tone: ToolTone;
  shimmer: boolean;
  icon: ReactNode;
} {
  const tone: ToolTone =
    state === "approval-requested"
      ? "warning"
      : state === "approval-responded"
        ? "accent"
        : state === "output-available"
          ? "success"
          : state === "output-denied"
            ? "warning"
            : state === "output-error"
              ? "danger"
              : "accent";

  return {
    label: statusLabels[state],
    tone,
    shimmer: state === "input-available" || state === "input-streaming",
    icon: statusIcons[state],
  };
}

export const getStatusBadge = (status: ToolPart["state"]) => (
  <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
    {statusIcons[status]}
    {statusLabels[status]}
  </Badge>
);

export type ToolCallRowProps = ComponentProps<"div"> & {
  icon?: ReactNode;
  label: string;
  status: string;
  summary?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tone?: ToolTone;
  shimmer?: boolean;
  elevated?: boolean;
};

export const ToolCallRow = ({
  className,
  icon,
  label,
  status,
  summary,
  meta,
  actions,
  tone = "neutral",
  shimmer = false,
  elevated = false,
  children,
  ...props
}: ToolCallRowProps) => {
  const toneClass = toneClasses[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[18px] px-3 py-2.5",
        elevated
          ? "border border-fresco-divider/80 bg-fresco-surface-muted shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          : "border border-transparent",
        toneClass.row,
        shimmer &&
          "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.02)_36%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.02)_64%,transparent_100%)] before:animate-[tool-row-shimmer_1.8s_ease-in-out_infinite]",
        className
      )}
      {...props}
    >
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
              toneClass.iconFrame
            )}
          >
            <span className={cn("flex items-center justify-center", toneClass.icon)}>
              {icon}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-medium text-fresco-title">
                {label}
              </span>
              <span className={cn("shrink-0 text-[11px] font-medium", toneClass.status)}>
                {status}
              </span>
            </div>
            {(summary || meta) && (
              <div className="mt-0.5 flex min-w-0 flex-col gap-0.5">
                {summary ? (
                  <div className="min-w-0 text-[11px] leading-relaxed text-fresco-description">
                    {summary}
                  </div>
                ) : null}
                {meta ? (
                  <div className="min-w-0 text-[10px] text-fresco-subtitle">{meta}</div>
                ) : null}
              </div>
            )}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        {children ? <div className="pl-9">{children}</div> : null}
      </div>
    </div>
  );
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      className={cn(
        // [TUNE] Tool header row — padding, layout
        "flex w-full items-center justify-between gap-4 p-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <WrenchIcon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title ?? derivedName}</span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      // [TUNE] Tool expanded content — padding, text color, animation
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 space-y-4 p-4 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  // [TUNE] Tool parameters section — spacing, label style
  <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    {/* [TUNE] Parameters code block background */}
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    // [TUNE] Tool output / error section
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          // [TUNE] Tool result block — text size, background, error vs success colors
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
