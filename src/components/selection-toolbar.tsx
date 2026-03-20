"use client";

import { X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SelectionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
}

export function SelectionToolbar({
  selectedCount,
  onClearSelection,
}: SelectionToolbarProps) {
  return (
    <div className="flex items-center gap-2.5">
      <Badge
        className={`h-7 px-2.5 text-xs font-semibold border border-[color-mix(in_srgb,var(--color-fresco-tint)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-fresco-tint)_10%,transparent)] text-[color-mix(in_srgb,var(--color-fresco-title)_78%,var(--color-fresco-tint))]`}
        variant="outline"
      >
        {selectedCount} selected
      </Badge>

      <Button
        onClick={onClearSelection}
        size="icon-sm"
        type="button"
        variant="ghost"
        aria-label="Clear selection"
      >
        <X />
      </Button>
    </div>
  );
}
