"use client";

import { Rows, X as XIcon } from "@phosphor-icons/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEventHandler,
  type KeyboardEventHandler,
} from "react";

import { cn } from "@/lib/utils";

export interface ChipItem {
  id: string;
  label: string;
}

export interface ChipInputHandle {
  focus: () => void;
  clear: () => void;
  getText: () => string;
}

interface ChipInputProps {
  chips: ChipItem[];
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onPaste?: ClipboardEventHandler<HTMLDivElement>;
  onBackspaceEmpty?: () => void;
  onRemoveChip?: (id: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * A contentEditable-based input that renders inline chip elements
 * before the editable text area — like Cursor/Kiro file reference chips.
 */
export const ChipInput = forwardRef<ChipInputHandle, ChipInputProps>(
  function ChipInput(
    {
      chips,
      value,
      onChange,
      onSubmit,
      onPaste,
      onBackspaceEmpty,
      onRemoveChip,
      placeholder,
      className,
      disabled,
      autoFocus,
    },
    ref,
  ) {
    const editableRef = useRef<HTMLDivElement>(null);
    const [isComposing, setIsComposing] = useState(false);
    // Track whether we're doing an internal DOM sync to avoid echo
    const isSyncingRef = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => editableRef.current?.focus(),
      clear: () => {
        if (editableRef.current) {
          const editable = getEditableSpan(editableRef.current);
          if (editable) editable.textContent = "";
        }
      },
      getText: () => {
        if (!editableRef.current) return "";
        const editable = getEditableSpan(editableRef.current);
        return editable?.textContent ?? "";
      },
    }));

    // Sync external value → DOM (only when they diverge and we're not mid-edit)
    useEffect(() => {
      if (isSyncingRef.current) return;
      const el = editableRef.current;
      if (!el) return;
      const editable = getEditableSpan(el);
      if (!editable) return;
      if (editable.textContent !== value) {
        isSyncingRef.current = true;
        editable.textContent = value;
        // Move cursor to end
        if (value.length > 0) {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(editable);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        isSyncingRef.current = false;
      }
    }, [value]);

    const handleInput = useCallback(() => {
      if (isSyncingRef.current) return;
      const el = editableRef.current;
      if (!el) return;
      const editable = getEditableSpan(el);
      const text = editable?.textContent ?? "";
      isSyncingRef.current = true;
      onChange(text);
      isSyncingRef.current = false;
    }, [onChange]);

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        if (e.key === "Enter") {
          if (isComposing || e.nativeEvent.isComposing) return;
          if (e.shiftKey) {
            // Allow newline — but we need to insert a \n manually in the editable span
            return;
          }
          e.preventDefault();
          onSubmit();
          return;
        }
        if (e.key === "Backspace") {
          const editable = getEditableSpan(editableRef.current!);
          if (editable && editable.textContent === "") {
            onBackspaceEmpty?.();
          }
        }
      },
      [isComposing, onSubmit, onBackspaceEmpty],
    );

    const handlePaste: ClipboardEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        // Check for files first — delegate to parent
        const items = e.clipboardData?.items;
        if (items) {
          for (const item of items) {
            if (item.kind === "file") {
              // Has files — let parent handle
              onPaste?.(e);
              return;
            }
          }
        }
        // Plain text paste — strip formatting
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain") ?? "";
        if (text) {
          document.execCommand("insertText", false, text);
        }
      },
      [onPaste],
    );

    // Auto-focus the editable span on mount
    useEffect(() => {
      if (!autoFocus) return;
      const el = editableRef.current;
      if (!el) return;
      const editable = getEditableSpan(el);
      editable?.focus();
    }, [autoFocus]);

    // When chips change, ensure cursor is in the editable span
    useEffect(() => {
      const el = editableRef.current;
      if (!el || !document.activeElement || !el.contains(document.activeElement)) return;
      const editable = getEditableSpan(el);
      if (editable) {
        const sel = window.getSelection();
        if (sel && (!sel.focusNode || !editable.contains(sel.focusNode))) {
          const range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, [chips]);

    const showPlaceholder = chips.length === 0 && !value;

    return (
      <div
        ref={editableRef}
        className={cn(
          "relative min-h-16 max-h-48 overflow-y-auto bg-transparent px-3 py-2.5 text-sm leading-relaxed text-fresco-title outline-none",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onClick={(e) => {
          // Only focus if clicking the container itself, not a chip button
          if ((e.target as HTMLElement).closest("button")) return;
          const editable = getEditableSpan(editableRef.current!);
          if (editable) {
            editable.focus();
            const sel = window.getSelection();
            if (sel) {
              const range = document.createRange();
              range.selectNodeContents(editable);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }}
      >
        {chips.map((chip) => (
          <span
            key={chip.id}
            contentEditable={false}
            className="group/chip mr-1.5 inline-flex translate-y-[2px] items-center gap-1 rounded-md border border-fresco-divider bg-fresco-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-fresco-tint select-none"
          >
            <Rows className="size-3 shrink-0" weight="fill" />
            <span className="max-w-32 truncate">{chip.label}</span>
            {onRemoveChip && (
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                className="ml-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm text-fresco-subtitle opacity-0 transition-opacity hover:text-fresco-title group-hover/chip:opacity-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveChip(chip.id);
                }}
              >
                <XIcon className="size-2.5" weight="bold" />
              </button>
            )}
          </span>
        ))}
        <span
          data-chip-editable="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          className="inline-block min-h-[1.5em] min-w-[2px] caret-fresco-title outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-fresco-subtitle [&:empty]:before:pointer-events-none"
          data-placeholder={showPlaceholder ? (placeholder ?? "") : chips.length > 0 ? "Ask about these items…" : ""}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          role="textbox"
          aria-label="Message input"
          aria-multiline="true"
        />
      </div>
    );
  },
);

/** Find the editable text span inside the container */
function getEditableSpan(container: HTMLElement): HTMLSpanElement | null {
  return container.querySelector<HTMLSpanElement>('[data-chip-editable="true"]');
}
