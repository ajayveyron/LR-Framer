"use client";

import {
  Brain,
  CaretDown,
  CircleNotch,
} from "@phosphor-icons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Shimmer } from "@/components/ui/shimmer";

/* ── Context ── */

type ChainOfThoughtCtx = { open: boolean; streaming: boolean };
const Ctx = createContext<ChainOfThoughtCtx>({ open: false, streaming: false });

/* ── Root ── */

type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Whether the reasoning is still streaming in */
  streaming?: boolean;
};

export function ChainOfThought({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  streaming = false,
  className,
  children,
  ...props
}: ChainOfThoughtProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  return (
    <Ctx.Provider value={{ open: isOpen, streaming }}>
      <Collapsible open={isOpen} onOpenChange={setOpen} asChild>
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-fresco-divider/60 bg-fresco-surface-muted/40",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </Collapsible>
    </Ctx.Provider>
  );
}

/* ── Header (trigger) ── */

type ChainOfThoughtHeaderProps = ComponentProps<typeof CollapsibleTrigger>;

export function ChainOfThoughtHeader({
  children,
  className,
  ...props
}: ChainOfThoughtHeaderProps) {
  const { streaming } = useContext(Ctx);

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-fresco-surface-muted/60",
        className,
      )}
      {...props}
    >
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-fresco-tint)_12%,transparent)]">
        {streaming ? (
          <CircleNotch className="size-3.5 animate-spin text-fresco-tint" />
        ) : (
          <Brain className="size-3.5 text-fresco-tint" weight="duotone" />
        )}
      </div>
      <span className="flex-1 text-[12px] font-medium text-fresco-subtitle">
        {streaming ? (
          <Shimmer as="span" duration={1.8} spread={2.4}>
            Thinking…
          </Shimmer>
        ) : (
          children ?? "Chain of Thought"
        )}
      </span>
      <CaretDown className="size-3.5 shrink-0 text-fresco-subtitle transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
    </CollapsibleTrigger>
  );
}

/* ── Content wrapper ── */

type ChainOfThoughtContentProps = ComponentProps<typeof CollapsibleContent>;

export function ChainOfThoughtContent({
  className,
  children,
  ...props
}: ChainOfThoughtContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "overflow-hidden border-t border-fresco-divider/40",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1",
        className,
      )}
      {...props}
    >
      <div className="px-3.5 py-3 text-[12px] leading-relaxed text-fresco-description whitespace-pre-wrap">
        {children}
      </div>
    </CollapsibleContent>
  );
}
