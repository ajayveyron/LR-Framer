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
        className="h-7 px-2.5 text-xs font-semibold framer-status-pill framer-status-pill-idle"
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
