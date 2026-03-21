"use client";

import { useRef, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Suggestions (container)                                           */
/* ------------------------------------------------------------------ */

export type SuggestionsProps = ComponentProps<"div">;

export function Suggestions({ className, children, ...props }: SuggestionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 scrollbar-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Suggestion (individual chip)                                      */
/* ------------------------------------------------------------------ */

export interface SuggestionProps
  extends Omit<ComponentProps<typeof Button>, "onClick"> {
  suggestion: string;
  onClick?: (suggestion: string) => void;
}

export function Suggestion({
  suggestion,
  onClick,
  className,
  ...props
}: SuggestionProps) {
  return (
    <Button
      className={cn(
        "shrink-0 rounded-full border-fresco-divider bg-fresco-surface-muted text-xs font-medium text-fresco-title transition-colors hover:border-fresco-tint hover:bg-fresco-divider",
        className,
      )}
      onClick={() => onClick?.(suggestion)}
      size="sm"
      type="button"
      variant="outline"
      {...props}
    >
      {suggestion}
    </Button>
  );
}
