"use client";

import { Sliders as Settings2Icon } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ColumnControls({
  onColumnsChange = () => {},
  options,
  selectedColumns,
}: {
  onColumnsChange?: (columns: string[]) => void;
  options: Array<{ key: string; label: string }>;
  selectedColumns: string[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-11 min-w-28 gap-2.5 px-4 text-sm font-semibold text-[color:var(--framer-fresco-settingsText-color)]"
          size="sm"
          type="button"
          variant="outline"
        >
          <Settings2Icon className="size-4" />
          <span>Columns</span>
          <Badge
            className="min-w-[22px] rounded-full border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-1.5 text-[11px] text-[color:var(--framer-fresco-panelSubtitle-color)]"
            variant="secondary"
          >
            {selectedColumns.length}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-60 rounded-xl p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
      >
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const checked = selectedColumns.includes(option.key);
          const isOnlyColumn = checked && selectedColumns.length === 1;

          return (
            <DropdownMenuCheckboxItem
              checked={checked}
              className="min-h-9 gap-2.5 rounded-lg px-2.5 text-[13px] text-[color:var(--framer-fresco-menuText-color)]"
              disabled={isOnlyColumn}
              key={option.key}
              onCheckedChange={() => {
                const nextSelected = checked
                  ? selectedColumns.filter((column) => column !== option.key)
                  : [...selectedColumns, option.key];

                onColumnsChange(nextSelected);
              }}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
