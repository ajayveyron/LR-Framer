"use client";

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TextB as BoldIcon,
  TextItalic as ItalicIcon,
  Code as Code2Icon,
  Link as Link2Icon,
  ListBullets as ListIcon,
  ListNumbers as ListOrderedIcon,
  Quotes as TextQuoteIcon,
  Sparkle,
  SpinnerGap,
  Check as CheckIcon,
  X as XIcon,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { logEvent, logError } from "@/lib/logger";

import type { RichTextBlockType } from "./rich-text-utils";
import {
  escapeHtml,
  getActiveBlockType,
  getEditorBlockElement,
  getEditorSelectionRange,
  getMarkdownShortcut,
  normalizeLinkUrl,
  richTextBlockOptions,
  sanitizeEditorHtml,
  toEditorHtml,
} from "./rich-text-utils";
import { computeWordDiff, htmlToPlainText } from "./diff-engine";

const toolbarButtonClassName =
  "border-fresco-input-border bg-fresco-input-bg text-fresco-text shadow-[inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)] placeholder:text-[color-mix(in_srgb,var(--color-fresco-text)_34%,transparent)] focus-visible:border-fresco-input-active focus-visible:shadow-[0_0_0_4px_var(--color-fresco-tint-dimmed),inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)] h-9 min-h-9 rounded-lg border px-3 py-0 shadow-none";
const toolbarActionGroupClassName =
  "rounded-none bg-fresco-surface-muted p-1 flex flex-wrap items-center gap-1 rounded-lg";
const toolbarActionButtonClassName =
  "text-fresco-button-text hover:bg-fresco-button-surface-hover hover:text-fresco-title focus-visible:bg-fresco-button-surface-hover focus-visible:text-fresco-title disabled:text-[color-mix(in_srgb,var(--color-fresco-button-text)_40%,transparent)] size-8 rounded-lg border-transparent bg-transparent p-0";
const editorContentClassName =
  "framer-editor-prose min-h-[280px] overflow-x-auto px-4 py-4 outline-none";

export function RichTextInput({
  onChange,
  rewriteContext,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  rewriteContext?: { title?: string; slug?: string };
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [activeBlockType, setActiveBlockType] =
    useState<RichTextBlockType>("p");
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<{
    element: HTMLAnchorElement;
    href: string;
    left: number;
    top: number;
  } | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogUrl, setLinkDialogUrl] = useState("");

  // ── Inline rewrite state ──
  const [rewriteStatus, setRewriteStatus] = useState<
    "idle" | "loading" | "diff" | "error"
  >("idle");
  const [rewrittenHtml, setRewrittenHtml] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const diffSegments = useMemo(() => {
    if (!rewrittenHtml) return null;
    return computeWordDiff(htmlToPlainText(value), htmlToPlainText(rewrittenHtml));
  }, [value, rewrittenHtml]);

  async function triggerRewrite() {
    setRewriteStatus("loading");
    setRewriteError(null);
    setRewrittenHtml(null);

    const controller = new AbortController();
    abortRef.current = controller;

    logEvent("info", "ai.rewrite.inline_requested", {
      htmlLength: value.length,
      hasContext: Boolean(rewriteContext),
    });

    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: value, context: rewriteContext }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Rewrite failed (${res.status})`);
      }

      const data = (await res.json()) as { rewritten: string };
      setRewrittenHtml(data.rewritten);
      setRewriteStatus("diff");

      logEvent("info", "ai.rewrite.inline_completed", {
        originalLength: value.length,
        rewrittenLength: data.rewritten.length,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        setRewriteStatus("idle");
        logEvent("info", "ai.rewrite.inline_cancelled", {});
        return;
      }
      const msg = err instanceof Error ? err.message : "Rewrite failed.";
      setRewriteError(msg);
      setRewriteStatus("error");
      logError("ai.rewrite.inline_failed", err);
    } finally {
      abortRef.current = null;
    }
  }

  function acceptRewrite() {
    if (!rewrittenHtml) return;
    logEvent("info", "ai.rewrite.inline_accepted", {
      originalLength: value.length,
      rewrittenLength: rewrittenHtml.length,
    });
    onChange(sanitizeEditorHtml(rewrittenHtml));
    resetRewrite();
  }

  function rejectRewrite() {
    logEvent("info", "ai.rewrite.inline_rejected", {});
    resetRewrite();
  }

  function resetRewrite() {
    setRewriteStatus("idle");
    setRewrittenHtml(null);
    setRewriteError(null);
  }

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextHtml = toEditorHtml(value);
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [value]);

  useEffect(() => {
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("defaultParagraphSeparator", false, "p");
  }, []);

  function syncValue() {
    onChange(sanitizeEditorHtml(editorRef.current?.innerHTML ?? ""));
  }

  function syncSelectionState() {
    const editor = editorRef.current;
    const range = getEditorSelectionRange(editor);
    const selection = document.getSelection();

    if (!editor || !range || !selection) {
      selectionRef.current = null;
      setHasTextSelection(false);
      return;
    }

    const anchorNode = selection.anchorNode;
    const nextHasTextSelection = !selection.isCollapsed;

    selectionRef.current = nextHasTextSelection ? range.cloneRange() : null;
    setHasTextSelection(nextHasTextSelection);
    setActiveBlockType(getActiveBlockType(anchorNode, editor));
  }

  function updateHoveredLink(eventTarget: EventTarget | null) {
    const editor = editorRef.current;
    if (!editor || !(eventTarget instanceof Node)) {
      setHoveredLink(null);
      return;
    }

    const anchor =
      eventTarget instanceof HTMLAnchorElement
        ? eventTarget
        : eventTarget.parentElement?.closest("a");

    if (!(anchor instanceof HTMLAnchorElement) || !editor.contains(anchor)) {
      setHoveredLink(null);
      return;
    }

    const href = anchor.getAttribute("href") ?? "";
    if (!href) {
      setHoveredLink(null);
      return;
    }

    const editorRect = editor.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    setHoveredLink({
      element: anchor,
      href,
      left: Math.max(12, anchorRect.left - editorRect.left),
      top: Math.max(8, anchorRect.bottom - editorRect.top + 8),
    });
  }

  useEffect(() => {
    function handleSelectionChange() {
      syncSelectionState();
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  function saveSelection() {
    const selection = document.getSelection();
    if (selection && selection.rangeCount > 0) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    const editor = editorRef.current;
    const selection = document.getSelection();

    if (!editor) {
      return;
    }

    editor.focus();

    if (!selection || !selectionRef.current) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  }

  function applyCommand(command: string, commandValue?: string) {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    syncSelectionState();
    syncValue();
  }

  function applyMarkdownShortcut() {
    const editor = editorRef.current;
    const selection = document.getSelection();
    const range = getEditorSelectionRange(editor);

    if (!editor || !selection || !range || !range.collapsed) {
      return false;
    }

    const block = getEditorBlockElement(editor, range.startContainer);
    if (!block) {
      return false;
    }

    const prefixRange = document.createRange();
    prefixRange.selectNodeContents(block);
    prefixRange.setEnd(range.startContainer, range.startOffset);

    const prefixText = prefixRange
      .toString()
      .replace(/\u00a0/g, " ")
      .trim();
    const shortcut = getMarkdownShortcut(prefixText);

    if (!shortcut) {
      return false;
    }

    prefixRange.deleteContents();

    if (!block.firstChild) {
      block.append(document.createElement("br"));
    }

    const caretRange = document.createRange();
    if (block.firstChild) {
      caretRange.setStart(block.firstChild, 0);
    } else {
      caretRange.setStart(block, 0);
    }
    caretRange.collapse(true);

    selection.removeAllRanges();
    selection.addRange(caretRange);

    if (shortcut.command === "formatBlock") {
      document.execCommand("formatBlock", false, shortcut.commandValue);
      if ("nextBlockType" in shortcut) {
        setActiveBlockType(shortcut.nextBlockType);
      }
    } else {
      document.execCommand(shortcut.command, false);
    }

    syncSelectionState();
    syncValue();
    return true;
  }

  function applyBlockFormat(nextBlockType: RichTextBlockType) {
    setActiveBlockType(nextBlockType);
    const nextOption = richTextBlockOptions.find(
      (option) => option.value === nextBlockType,
    );
    applyCommand("formatBlock", nextOption?.commandValue ?? "<p>");
  }

  function handleLink() {
    saveSelection();
    setLinkDialogUrl("");
    setLinkDialogOpen(true);
  }

  function confirmLink(rawUrl: string) {
    setLinkDialogOpen(false);
    const normalizedUrl = normalizeLinkUrl(rawUrl.trim());
    if (!normalizedUrl) {
      applyCommand("unlink");
      return;
    }

    restoreSelection();
    const selection = document.getSelection();
    if (!selection?.isCollapsed) {
      document.execCommand("createLink", false, normalizedUrl);
    } else {
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${escapeHtml(normalizedUrl)}">${escapeHtml(normalizedUrl)}</a>`,
      );
    }
    syncSelectionState();
    syncValue();
  }

  function selectHoveredLink() {
    if (!hoveredLink) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(hoveredLink.element);
    const selection = document.getSelection();
    if (!selection) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    selectionRef.current = range.cloneRange();
    hoveredLink.element.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === " " && applyMarkdownShortcut()) {
      event.preventDefault();
      return;
    }

    if (!hasTextSelection) {
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      applyCommand("bold");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      applyCommand("italic");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      handleLink();
    }
  }

  return (
    <div className="rounded-none border border-fresco-divider bg-fresco-surface-elevated shadow-[inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)] relative overflow-hidden rounded-lg">
      <div className="border-b border-b-fresco-divider bg-fresco-surface-subtle flex flex-wrap items-center gap-2 px-3 py-2">
        <Select
          disabled={!hasTextSelection}
          onValueChange={(nextValue) => {
            applyBlockFormat(nextValue as RichTextBlockType);
          }}
          value={activeBlockType}
        >
          <SelectTrigger
            className={cn(
              toolbarButtonClassName,
              "min-w-[172px] justify-between text-left text-sm text-fresco-text",
            )}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
          >
            <SelectValue placeholder="Paragraph" />
          </SelectTrigger>
          <SelectContent>
            {richTextBlockOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className={toolbarActionGroupClassName}>
          <Button
            aria-label="Insert link"
            className={toolbarActionButtonClassName}
            disabled={!hasTextSelection}
            onMouseDown={(event) => {
              event.preventDefault();
              handleLink();
            }}
            size="xs"
            title="Insert link"
            type="button"
            variant="ghost"
          >
            <Link2Icon className="size-4" />
          </Button>
          <Button
            aria-label="Bold"
            className={toolbarActionButtonClassName}
            disabled={!hasTextSelection}
            onMouseDown={(event) => {
              event.preventDefault();
              applyCommand("bold");
            }}
            size="xs"
            title="Bold"
            type="button"
            variant="ghost"
          >
            <BoldIcon className="size-4" />
          </Button>
          <Button
            aria-label="Italic"
            className={toolbarActionButtonClassName}
            disabled={!hasTextSelection}
            onMouseDown={(event) => {
              event.preventDefault();
              applyCommand("italic");
            }}
            size="xs"
            title="Italic"
            type="button"
            variant="ghost"
          >
            <ItalicIcon className="size-4" />
          </Button>
          <Button
            aria-label="Quote"
            className={toolbarActionButtonClassName}
            disabled={!hasTextSelection}
            onMouseDown={(event) => {
              event.preventDefault();
              applyCommand("formatBlock", "<blockquote>");
            }}
            size="xs"
            title="Quote"
            type="button"
            variant="ghost"
          >
            <TextQuoteIcon className="size-4" />
          </Button>
          <Button
            aria-label="Code block"
            className={toolbarActionButtonClassName}
            disabled={!hasTextSelection}
            onMouseDown={(event) => {
              event.preventDefault();
              applyCommand("formatBlock", "<pre>");
            }}
            size="xs"
            title="Code block"
            type="button"
            variant="ghost"
          >
            <Code2Icon className="size-4" />
          </Button>
          <Button
            aria-label="Bulleted list"
            className={toolbarActionButtonClassName}
            disabled={!hasTextSelection}
            onMouseDown={(event) => {
              event.preventDefault();
              applyCommand("insertUnorderedList");
            }}
            size="xs"
            title="Bulleted list"
            type="button"
            variant="ghost"
          >
            <ListIcon className="size-4" />
          </Button>
          <Button
            aria-label="Numbered list"
            className={toolbarActionButtonClassName}
            disabled={!hasTextSelection}
            onMouseDown={(event) => {
              event.preventDefault();
              applyCommand("insertOrderedList");
            }}
            size="xs"
            title="Numbered list"
            type="button"
            variant="ghost"
          >
            <ListOrderedIcon className="size-4" />
          </Button>
        </div>

        {/* {rewriteContext ? (
          <div className={toolbarActionGroupClassName}>
            <Button
              aria-label="Rewrite with AI"
              className={toolbarActionButtonClassName}
              disabled={rewriteStatus === "loading" || rewriteStatus === "diff"}
              onMouseDown={(event) => {
                event.preventDefault();
                triggerRewrite();
              }}
              size="xs"
              title="Rewrite with AI"
              type="button"
              variant="ghost"
            >
              {rewriteStatus === "loading" ? (
                <SpinnerGap className="size-4 animate-spin" />
              ) : (
                <Sparkle className="size-4" weight="duotone" />
              )}
            </Button>
          </div>
        ) : null} */}
      </div>

      {/* ── Diff view (replaces editor when active) ── */}
      {rewriteStatus === "loading" && (
        <div className={cn(editorContentClassName, "flex flex-col items-center justify-center gap-2 text-fresco-subtitle")}>
          <SpinnerGap className="size-6 animate-spin" />
          <span className="text-xs">Optimizing for SEO, GEO &amp; AEO…</span>
          <Button
            className="mt-1"
            onClick={() => abortRef.current?.abort()}
            size="xs"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-3.5" />
            Cancel
          </Button>
        </div>
      )}

      {rewriteStatus === "diff" && diffSegments && (
        <>
          <div className={cn(editorContentClassName, "select-text")}>
            {diffSegments.map((seg, idx) => {
              if (seg.type === "removed") {
                return (
                  <span key={idx} className="text-red-400 line-through decoration-red-400/60">
                    {seg.text}{" "}
                  </span>
                );
              }
              if (seg.type === "added") {
                return (
                  <span key={idx} className="text-emerald-400">
                    {seg.text}{" "}
                  </span>
                );
              }
              return (
                <span key={idx} className="text-fresco-description">
                  {seg.text}{" "}
                </span>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-fresco-divider px-3 py-2">
            <Button
              onClick={rejectRewrite}
              size="xs"
              type="button"
              variant="ghost"
            >
              <XIcon className="size-3.5" />
              Reject
            </Button>
            <Button
              onClick={() => {
                resetRewrite();
                triggerRewrite();
              }}
              size="xs"
              type="button"
              variant="ghost"
            >
              <ArrowCounterClockwise className="size-3.5" />
              Regenerate
            </Button>
            <Button
              onClick={acceptRewrite}
              size="xs"
              type="button"
              variant="ghost"
            >
              <CheckIcon className="size-3.5" />
              Accept
            </Button>
          </div>
        </>
      )}

      {rewriteStatus === "error" && (
        <div className={cn(editorContentClassName, "flex flex-col items-center justify-center gap-2")}>
          <p className="text-xs text-red-400">{rewriteError}</p>
          <Button
            onClick={() => {
              resetRewrite();
              triggerRewrite();
            }}
            size="xs"
            type="button"
            variant="ghost"
          >
            <ArrowCounterClockwise className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* ── Normal editor (hidden during rewrite) ── */}
      {rewriteStatus === "idle" && (
        <>
          <div
            aria-label={placeholder || "Rich text editor"}
            aria-multiline="true"
            className={editorContentClassName}
            contentEditable
            data-placeholder={placeholder}
            onBlur={syncValue}
            onInput={syncValue}
            onKeyDown={handleKeyDown}
            onKeyUp={syncSelectionState}
            onMouseLeave={() => setHoveredLink(null)}
            onMouseMove={(event) => updateHoveredLink(event.target)}
            onMouseUp={syncSelectionState}
            ref={editorRef}
            role="textbox"
            suppressContentEditableWarning
          />
          {hoveredLink ? (
            <div
              className="absolute z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-lg border border-fresco-divider bg-fresco-menu-bg px-2.5 py-2 text-xs text-fresco-menu-text shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
              style={{ left: hoveredLink.left, top: hoveredLink.top }}
            >
              <span className="max-w-52 truncate text-fresco-subtitle">
                {hoveredLink.href}
              </span>
              <Button
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectHoveredLink();
                  handleLink();
                }}
                size="xs"
                type="button"
                variant="ghost"
              >
                Edit
              </Button>
              <Button
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectHoveredLink();
                  applyCommand("unlink");
                  setHoveredLink(null);
                }}
                size="xs"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </div>
          ) : null}
        </>
      )}

      {/* Link insertion dialog — replaces window.prompt() */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => { if (!open) setLinkDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>Enter a URL to create a hyperlink.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmLink(linkDialogUrl);
            }}
          >
            <Input
              autoFocus
              className="my-4"
              onChange={(e) => setLinkDialogUrl(e.target.value)}
              placeholder="https://example.com"
              type="url"
              value={linkDialogUrl}
            />
            <DialogFooter>
              <Button onClick={() => setLinkDialogOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
