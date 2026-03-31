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
    const prefixLengthRef = useRef(0);
    const [isComposing, setIsComposing] = useState(false);
    // Track whether we're doing an internal DOM sync to avoid echo
    const isSyncingRef = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => {
        const suffix = getSuffixEditableSpan(editableRef.current);
        suffix?.focus();
      },
      clear: () => {
        if (editableRef.current) {
          const prefix = getPrefixEditableSpan(editableRef.current);
          const suffix = getSuffixEditableSpan(editableRef.current);
          if (prefix) prefix.textContent = "";
          if (suffix) suffix.textContent = "";
          prefixLengthRef.current = 0;
        }
      },
      getText: () => {
        if (!editableRef.current) return "";
        const prefix = getPrefixEditableSpan(editableRef.current);
        const suffix = getSuffixEditableSpan(editableRef.current);
        return `${prefix?.textContent ?? ""}${suffix?.textContent ?? ""}`;
      },
    }));

    // Sync external value → DOM (only when they diverge and we're not mid-edit)
    useEffect(() => {
      if (isSyncingRef.current) return;
      const el = editableRef.current;
      if (!el) return;
      const prefix = getPrefixEditableSpan(el);
      const suffix = getSuffixEditableSpan(el);
      if (!suffix) return;

      const nextPrefix =
        chips.length > 0
          ? value.slice(0, Math.min(prefixLengthRef.current, value.length))
          : "";
      const nextSuffix = chips.length > 0 ? value.slice(nextPrefix.length) : value;
      const currentPrefix = prefix?.textContent ?? "";
      const currentSuffix = suffix.textContent ?? "";

      if (currentPrefix !== nextPrefix || currentSuffix !== nextSuffix) {
        isSyncingRef.current = true;
        if (prefix) prefix.textContent = nextPrefix;
        suffix.textContent = nextSuffix;
        prefixLengthRef.current = nextPrefix.length;
        // Move cursor to end
        if (value.length > 0) {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(suffix);
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
      const prefix = getPrefixEditableSpan(el);
      const suffix = getSuffixEditableSpan(el);
      const prefixText = prefix?.textContent ?? "";
      const suffixText = suffix?.textContent ?? "";
      const text = `${prefixText}${suffixText}`;
      isSyncingRef.current = true;
      prefixLengthRef.current = prefixText.length;
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
          const prefix = getPrefixEditableSpan(editableRef.current);
          const suffix = getSuffixEditableSpan(editableRef.current);
          if (
            (prefix?.textContent ?? "") === "" &&
            (suffix?.textContent ?? "") === ""
          ) {
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
      const suffix = getSuffixEditableSpan(el);
      suffix?.focus();
    }, [autoFocus]);

    // When chips change, ensure cursor is in the editable span
    useEffect(() => {
      const el = editableRef.current;
      if (!el || !document.activeElement || !el.contains(document.activeElement)) return;
      const activeEditable =
        getPrefixEditableSpan(el)?.contains(document.activeElement)
          ? getPrefixEditableSpan(el)
          : getSuffixEditableSpan(el);
      if (activeEditable) {
        const sel = window.getSelection();
        if (sel && (!sel.focusNode || !activeEditable.contains(sel.focusNode))) {
          const range = document.createRange();
          range.selectNodeContents(activeEditable);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, [chips]);

    const showPlaceholder = !value;

    const focusEditable = useCallback(
      (target: "prefix" | "suffix", toEnd = true) => {
        const el = editableRef.current;
        if (!el) return;
        const editable =
          target === "prefix"
            ? getPrefixEditableSpan(el)
            : getSuffixEditableSpan(el);
        if (!editable) return;

        editable.focus();
        const sel = window.getSelection();
        if (!sel) return;
        const range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(toEnd);
        sel.removeAllRanges();
        sel.addRange(range);
      },
      [],
    );

    return (
      <div
        ref={editableRef}
        className={cn(
          "relative min-h-16 max-h-48 overflow-y-auto bg-transparent px-3 py-2.5 text-sm leading-relaxed text-fresco-title caret-fresco-title outline-none",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onClick={(e) => {
          // Only focus if clicking the container itself, not a chip button
          if ((e.target as HTMLElement).closest("button")) return;
          focusEditable("suffix");
        }}
      >
        {chips.length > 0 ? (
          <span
            data-chip-prefix-editable="true"
            contentEditable={!disabled}
            suppressContentEditableWarning
            className="inline min-h-[1.5em] min-w-[2px] whitespace-pre-wrap break-words caret-fresco-title outline-none"
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            role="textbox"
            aria-label="Message input prefix"
            aria-multiline="true"
          />
        ) : null}
        {chips.map((chip) => (
          <span
            key={chip.id}
            contentEditable={false}
            className="group/chip mr-1.5 inline-flex align-middle items-center gap-1 rounded-md border border-fresco-divider bg-fresco-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-fresco-tint select-none"
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              e.preventDefault();
              const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const clickedLeftHalf = e.clientX < bounds.left + bounds.width / 2;
              focusEditable(clickedLeftHalf ? "prefix" : "suffix");
            }}
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
          data-chip-suffix-editable="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          className="inline whitespace-pre-wrap break-words caret-fresco-title outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-fresco-subtitle [&:empty]:before:pointer-events-none"
          data-placeholder={
            showPlaceholder
              ? chips.length > 0
                ? "Ask about these items…"
                : (placeholder ?? "")
              : ""
          }
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

function getPrefixEditableSpan(container: HTMLElement | null): HTMLSpanElement | null {
  if (!container) return null;
  return container.querySelector<HTMLSpanElement>('[data-chip-prefix-editable="true"]');
}

function getSuffixEditableSpan(container: HTMLElement | null): HTMLSpanElement | null {
  if (!container) return null;
  return container.querySelector<HTMLSpanElement>('[data-chip-suffix-editable="true"]');
}
