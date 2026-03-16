"use client";

import { Settings2Icon } from "lucide-react";

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
          className="columns-trigger"
          size="sm"
          type="button"
          variant="outline"
        >
          <Settings2Icon className="size-4" />
          <span>Columns</span>
          <Badge className="columns-count" variant="secondary">
            {selectedColumns.length}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="columns-menu">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const checked = selectedColumns.includes(option.key);
          const isOnlyColumn = checked && selectedColumns.length === 1;

          return (
            <DropdownMenuCheckboxItem
              checked={checked}
              className="columns-option"
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
