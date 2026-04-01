"use client";

import {
  CaretDown,
  Sparkle,
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
  useEffect,
  useRef,
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
  const wasStreaming = useRef(streaming);
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  // Auto-collapse when reasoning finishes streaming
  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      setInternalOpen(false);
    }
    wasStreaming.current = streaming;
  }, [streaming]);

  return (
    <Ctx.Provider value={{ open: isOpen, streaming }}>
      <Collapsible open={isOpen} onOpenChange={setOpen} asChild>
        <div
          className={cn("overflow-hidden", className)}
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
        "flex w-full items-center gap-1.5 py-1 text-left transition-colors",
        className,
      )}
      {...props}
    >
      <Sparkle
        className={cn(
          "size-3 shrink-0 text-fresco-subtitle/60",
          streaming && "animate-pulse",
        )}
        weight="fill"
      />
      <span className="flex-1 text-[11px] font-medium text-fresco-subtitle/70">
        {streaming ? (
          <Shimmer as="span" duration={1.8} spread={2.4}>
            Thinking…
          </Shimmer>
        ) : (
          children ?? "Reasoning"
        )}
      </span>
      <CaretDown className="size-3 shrink-0 text-fresco-subtitle/40 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
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
        "overflow-hidden",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1",
        className,
      )}
      {...props}
    >
      <div className="pl-[18px] pb-1 text-[11.5px] leading-relaxed text-fresco-description/60 whitespace-pre-wrap">
        {children}
      </div>
    </CollapsibleContent>
  );
}
