"use client";

import { useEffect, useId, useRef, useState } from "react";

export function ColumnControls({
  onColumnsChange = () => {},
  options,
  selectedColumns,
}: {
  onColumnsChange?: (columns: string[]) => void;
  options: Array<{ key: string; label: string }>;
  selectedColumns: string[];
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstCheckboxRef = useRef<HTMLInputElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    firstCheckboxRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="columns-dropdown" ref={dropdownRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="button-secondary columns-trigger"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        Columns
        <span className="columns-count">{selectedColumns.length}</span>
      </button>

      {open ? (
        <div
          aria-label="Visible columns"
          className="columns-menu"
          id={menuId}
          role="dialog"
        >
          {options.map((option) => {
            const checked = selectedColumns.includes(option.key);
            const isOnlyColumn = checked && selectedColumns.length === 1;

            return (
              <label className="columns-option" key={option.key}>
                <input
                  checked={checked}
                  disabled={isOnlyColumn}
                  ref={option === options[0] ? firstCheckboxRef : undefined}
                  onChange={() => {
                    const nextSelected = checked
                      ? selectedColumns.filter((column) => column !== option.key)
                      : [...selectedColumns, option.key];

                    onColumnsChange(nextSelected);
                  }}
                  type="checkbox"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
