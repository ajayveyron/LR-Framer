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
    // Stable ref to onChange so the native listener always calls the latest version
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

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
    }, [value, chips]);

    // Read text from the contentEditable spans and push to onChange.
    // Used both by the native listener and the React onInput fallback.
    const syncTextFromDOM = useCallback(() => {
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
      try {
        onChangeRef.current(text);
      } finally {
        isSyncingRef.current = false;
      }
    }, []);

    // Native `input` event listener on the container div.
    // React's synthetic onInput on contentEditable spans can silently unbind
    // across HMR / Fast Refresh cycles. A native listener attached via
    // addEventListener is immune to this — it survives as long as the DOM
    // element exists.
    useEffect(() => {
      const el = editableRef.current;
      if (!el) return;
      const handler = () => syncTextFromDOM();
      el.addEventListener("input", handler);
      return () => el.removeEventListener("input", handler);
    }, [syncTextFromDOM]);

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        if (e.key === "Enter") {
          if (isComposing || e.nativeEvent.isComposing) return;
          if (e.shiftKey) {
            e.preventDefault();
            document.execCommand("insertLineBreak");
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
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            editableRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
          }
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

    // When chips change, preserve caret position within the active editable span.
    // Save offset before React re-renders the chip list, then restore it.
    const savedCaretRef = useRef<{ target: "prefix" | "suffix"; offset: number } | null>(null);

    // Save caret position before chips change triggers a re-render
    useEffect(() => {
      const el = editableRef.current;
      if (!el || !document.activeElement || !el.contains(document.activeElement)) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const prefix = getPrefixEditableSpan(el);
      const suffix = getSuffixEditableSpan(el);
      const focusNode = sel.focusNode;
      if (prefix && prefix.contains(focusNode)) {
        savedCaretRef.current = { target: "prefix", offset: sel.focusOffset };
      } else if (suffix && suffix.contains(focusNode)) {
        savedCaretRef.current = { target: "suffix", offset: sel.focusOffset };
      }
    });

    // Restore caret position after chips change
    useEffect(() => {
      const saved = savedCaretRef.current;
      if (!saved) return;
      savedCaretRef.current = null;

      const el = editableRef.current;
      if (!el) return;
      const editable =
        saved.target === "prefix"
          ? getPrefixEditableSpan(el)
          : getSuffixEditableSpan(el);
      // If the target span no longer exists (e.g. chips removed → no prefix), fall back to suffix
      const target = editable ?? getSuffixEditableSpan(el);
      if (!target) return;

      const textNode = target.firstChild;
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const clampedOffset = Math.min(saved.offset, textNode.textContent?.length ?? 0);
        range.setStart(textNode, clampedOffset);
        range.collapse(true);
      } else {
        range.selectNodeContents(target);
        range.collapse(false);
      }
      sel.removeAllRanges();
      sel.addRange(range);
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
        data-slot="input-group-control"
        tabIndex={-1}
        className={cn(
          "relative flex min-h-16 max-h-48 flex-wrap items-start overflow-y-auto bg-transparent px-3 py-2.5 text-sm leading-relaxed text-fresco-title caret-fresco-title outline-none",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onClick={(e) => {
          // Only force-focus when clicking the container padding/empty area.
          // Don't interfere when clicking inside editable spans (preserves cursor position in text)
          // or on chip buttons.
          const target = e.target as HTMLElement;
          if (target.closest("button")) return;
          if (target.closest("[contenteditable]")) return;
          focusEditable("suffix");
        }}
      >
        {chips.length > 0 ? (
          <span
            data-chip-prefix-editable="true"
            contentEditable={!disabled}
            suppressContentEditableWarning
            className="min-h-[1.5em] min-w-[2px] whitespace-pre-wrap break-words caret-fresco-title outline-none"
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => requestAnimationFrame(() => setIsComposing(false))}
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
          className="min-h-[1.5em] min-w-[2px] flex-1 whitespace-pre-wrap break-words caret-fresco-title outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-fresco-subtitle [&:empty]:before:pointer-events-none"
          data-placeholder={
            showPlaceholder
              ? chips.length > 0
                ? "Ask about these items…"
                : (placeholder ?? "")
              : ""
          }
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => requestAnimationFrame(() => setIsComposing(false))}
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
