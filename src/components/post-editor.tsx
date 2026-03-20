"use client";

import {
  startTransition,
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AsteriskSimple as AsteriskIcon,
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

import { AIImageDialog } from "@/components/ai-image-dialog";
import { useNotify } from "@/components/notification-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";
import { TRANSIENT_FRAMER_EDITOR_MESSAGE } from "@/lib/framer-copy";
import { cn } from "@/lib/utils";
import { logEvent, logError } from "@/lib/logger";
import { buildPostInputSchema, type PostInputPayload } from "@/lib/post-schema";

type FormValues = PostInputPayload;
const EMPTY_SELECT_VALUE = "__none__";
const fieldClassName = "flex flex-col gap-2";
const wideFieldClassName = "max-w-none";
const labelRowClassName = "flex items-center justify-between gap-2.5";
const metaBadgeClassName =
  "h-6 rounded-full border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]";
const helperTextClassName =
  "text-[13px] leading-[1.45] text-[color:var(--framer-fresco-panelSubtitle-color)]";
const fieldErrorClassName =
  "text-[13px] text-[color:var(--framer-app-danger-callout-text-color)]";
const formControlClassName =
  "framer-form-control h-10 rounded-lg border px-3 py-2.5 font-sans text-sm leading-[1.4]";
const titleControlClassName =
  "h-12 text-[clamp(20px,1.7vw,26px)] leading-[1.1] tracking-[-0.03em]";
const toolbarButtonClassName =
  "framer-form-control h-9 min-h-9 rounded-lg border px-3 py-0 shadow-none";
const toolbarActionGroupClassName =
  "framer-toolbar-group flex flex-wrap items-center gap-1 rounded-lg";
const toolbarActionButtonClassName =
  "framer-toolbar-button size-8 rounded-lg border-transparent bg-transparent p-0";
const primaryButtonClassName = "framer-primary-tint-action";
const warningBannerClassName = "framer-callout-info";
const editorContentClassName =
  "framer-editor-prose min-h-[280px] overflow-x-auto px-4 py-4 outline-none";

type RichTextBlockType = "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type MarkdownShortcut =
  | {
      command: "formatBlock";
      commandValue: string;
      nextBlockType: RichTextBlockType;
    }
  | { command: "formatBlock"; commandValue: "<blockquote>" | "<pre>" }
  | { command: "insertUnorderedList" | "insertOrderedList" };

const richTextBlockOptions: Array<{
  commandValue: string;
  label: string;
  value: RichTextBlockType;
}> = [
  { value: "p", label: "Paragraph", commandValue: "<p>" },
  { value: "h1", label: "H1", commandValue: "<h1>" },
  { value: "h2", label: "H2", commandValue: "<h2>" },
  { value: "h3", label: "H3", commandValue: "<h3>" },
  { value: "h4", label: "H4", commandValue: "<h4>" },
  { value: "h5", label: "H5", commandValue: "<h5>" },
  { value: "h6", label: "H6", commandValue: "<h6>" },
];

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const ALLOWED_EDITOR_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "u",
  "ul",
]);

const STRIP_CONTENT_TAGS = new Set([
  "iframe",
  "object",
  "script",
  "style",
  "svg",
]);

function sanitizeLinkHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }

  try {
    const normalized = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);

    if (normalized.protocol === "http:" || normalized.protocol === "https:") {
      return normalized.toString();
    }
  } catch {
    return "";
  }

  return "";
}

function sanitizeEditorHtml(html: string) {
  if (typeof document === "undefined" || !html.trim()) {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  const sanitizeNode = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        continue;
      }

      if (!(child instanceof HTMLElement)) {
        child.parentNode?.removeChild(child);
        continue;
      }

      const tagName = child.tagName.toLowerCase();
      if (STRIP_CONTENT_TAGS.has(tagName)) {
        child.remove();
        continue;
      }

      if (!ALLOWED_EDITOR_TAGS.has(tagName)) {
        const fragment = document.createDocumentFragment();
        while (child.firstChild) {
          fragment.appendChild(child.firstChild);
        }
        child.replaceWith(fragment);
        sanitizeNode(node);
        continue;
      }

      for (const attribute of Array.from(child.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on") || name === "style") {
          child.removeAttribute(attribute.name);
          continue;
        }

        if (tagName === "a" && name === "href") {
          const safeHref = sanitizeLinkHref(attribute.value);
          if (safeHref) {
            child.setAttribute("href", safeHref);
          } else {
            child.removeAttribute("href");
          }
          continue;
        }

        child.removeAttribute(attribute.name);
      }

      sanitizeNode(child);
    }
  };

  sanitizeNode(container);
  return container.innerHTML;
}

function toEditorHtml(value: string) {
  if (!value) {
    return "";
  }

  if (looksLikeHtml(value)) {
    return sanitizeEditorHtml(value);
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br />");

      return `<p>${lines || "<br />"}</p>`;
    })
    .join("");
}

function getActiveBlockType(
  anchorNode: Node | null,
  editor: HTMLDivElement,
): RichTextBlockType {
  let currentElement =
    anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;

  while (currentElement && currentElement !== editor) {
    const tagName = currentElement.tagName.toLowerCase();
    if (richTextBlockOptions.some((option) => option.value === tagName)) {
      return tagName as RichTextBlockType;
    }
    currentElement = currentElement.parentElement;
  }

  return "p";
}

function getEditorBlockElement(
  editor: HTMLDivElement,
  anchorNode: Node | null,
): HTMLElement | null {
  let currentElement =
    anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;

  while (currentElement && currentElement !== editor) {
    const tagName = currentElement.tagName.toLowerCase();
    if (
      [
        "p",
        "div",
        "li",
        "blockquote",
        "pre",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ].includes(tagName)
    ) {
      return currentElement as HTMLElement;
    }
    currentElement = currentElement.parentElement;
  }

  return null;
}

function getEditorSelectionRange(editor: HTMLDivElement | null) {
  const selection = document.getSelection();
  if (!editor || !selection || selection.rangeCount === 0) {
    return null;
  }

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (
    !anchorNode ||
    !focusNode ||
    !editor.contains(anchorNode) ||
    !editor.contains(focusNode)
  ) {
    return null;
  }

  return selection.getRangeAt(0);
}

function getMarkdownShortcut(value: string): MarkdownShortcut | null {
  if (/^#{1,6}$/.test(value)) {
    const level = value.length as 1 | 2 | 3 | 4 | 5 | 6;
    return {
      command: "formatBlock",
      commandValue: `<h${level}>`,
      nextBlockType: `h${level}` as RichTextBlockType,
    };
  }

  if (value === ">") {
    return {
      command: "formatBlock",
      commandValue: "<blockquote>",
    };
  }

  if (value === "```") {
    return {
      command: "formatBlock",
      commandValue: "<pre>",
    };
  }

  if (value === "-" || value === "*" || value === "+") {
    return {
      command: "insertUnorderedList",
    };
  }

  if (/^\d+\.$/.test(value)) {
    return {
      command: "insertOrderedList",
    };
  }

  return null;
}

function normalizeLinkUrl(value: string) {
  return sanitizeLinkHref(value);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getAssetLabel(value: string) {
  try {
    const pathname = new URL(value).pathname;
    return pathname.split("/").at(-1) || value;
  } catch {
    return value.split("/").at(-1) || value;
  }
}

function formatDateValue(value: DashboardFieldValue, displayTime?: boolean) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  if (displayTime) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  }

  return date.toISOString().slice(0, 10);
}

function getDefaultFieldValue(
  field: DashboardFieldDefinition,
  post: BlogPostRecord | null,
) {
  const value = post?.fieldValues[field.id];

  switch (field.type) {
    case "boolean":
      return typeof value === "boolean" ? value : false;
    case "number":
      return typeof value === "number" ? value : "";
    case "multiCollectionReference":
      return Array.isArray(value) ? value : [];
    case "date":
      return formatDateValue(value ?? null, field.displayTime);
    default:
      return value ?? "";
  }
}

function getFieldErrorMessage(
  errors: FormValues["fieldValues"] | undefined,
  fieldId: string,
) {
  const entry = errors?.[fieldId] as { message?: string } | undefined;
  return entry?.message;
}

function isLongTextField(field: DashboardFieldDefinition) {
  if (field.type === "formattedText") {
    return true;
  }

  return (
    field.type === "string" &&
    (field.logicalKey === "body" ||
      /description|summary|excerpt/i.test(field.name))
  );
}

function FieldLabel({
  htmlFor,
  name,
  required = false,
}: {
  htmlFor?: string;
  name: string;
  required?: boolean;
}) {
  return (
    <Label
      className="text-[13px] tracking-wide text-[color:var(--framer-fresco-panelTitle-color)]"
      htmlFor={htmlFor}
    >
      {name}
      {required ? (
        <>
          <span
            aria-hidden="true"
            className="inline-flex text-[color:var(--framer-fresco-errorTint-color)]"
          >
            <AsteriskIcon className="size-2" weight="bold" />
          </span>
          <span className="sr-only"> required</span>
        </>
      ) : null}
    </Label>
  );
}

function ReadOnlyField({
  field,
  value,
}: {
  field: DashboardFieldDefinition;
  value: DashboardFieldValue;
}) {
  return (
    <div className={cn(fieldClassName, wideFieldClassName)}>
      <div className={labelRowClassName}>
        <Label>{field.name}</Label>
        <Badge className={metaBadgeClassName} variant="outline">
          Read only
        </Badge>
      </div>
      <div className={warningBannerClassName}>
        {field.helpText ??
          "This field type is visible but not editable in the dashboard."}
      </div>
      <div className="framer-subtle-panel px-4 py-3 text-sm text-[color:var(--framer-fresco-settingsText-color)]">
        {Array.isArray(value) ? value.join(", ") : String(value ?? "")}
      </div>
    </div>
  );
}

// ── Inline rewrite diff helpers ──

interface DiffSegment {
  type: "unchanged" | "removed" | "added";
  text: string;
}

function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = sanitizeEditorHtml(html);
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}

function computeWordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);
  const m = oldWords.length;
  const n = newWords.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldWords[i - 1] === newWords[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const raw: DiffSegment[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      raw.push({ type: "unchanged", text: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ type: "added", text: newWords[j - 1] });
      j--;
    } else {
      raw.push({ type: "removed", text: oldWords[i - 1] });
      i--;
    }
  }
  raw.reverse();

  const segments: DiffSegment[] = [];
  for (const seg of raw) {
    const last = segments[segments.length - 1];
    if (last && last.type === seg.type) {
      last.text += " " + seg.text;
    } else {
      segments.push({ ...seg });
    }
  }
  return segments;
}

function RichTextInput({
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
    const rawUrl = window.prompt("Enter a URL");
    if (rawUrl === null) {
      return;
    }

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
    <div className="framer-elevated-panel relative overflow-hidden rounded-lg">
      <div className="framer-toolbar-strip flex flex-wrap items-center gap-2 px-3 py-2">
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
              "min-w-[172px] justify-between text-left text-sm text-[color:var(--framer-fresco-settingsText-color)]",
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
        <div className={cn(editorContentClassName, "flex flex-col items-center justify-center gap-2 text-[color:var(--framer-fresco-panelSubtitle-color)]")}>
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
                <span key={idx} className="text-[color:var(--framer-fresco-panelDescription-color)]">
                  {seg.text}{" "}
                </span>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[var(--framer-fresco-panelDivider-color)] px-3 py-2">
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
            suppressContentEditableWarning
          />
          {hoveredLink ? (
            <div
              className="absolute z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-lg border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-menuBackground-color)] px-2.5 py-2 text-xs text-[color:var(--framer-fresco-menuText-color)] shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
              style={{ left: hoveredLink.left, top: hoveredLink.top }}
            >
              <span className="max-w-52 truncate text-[color:var(--framer-fresco-panelSubtitle-color)]">
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
    </div>
  );
}

export function PostEditor({
  framerUnavailable = false,
  metadata,
  mode,
  onClose,
  onPostSaved,
  post,
}: {
  framerUnavailable?: boolean;
  metadata: BlogCollectionMetadata;
  mode: "create" | "edit";
  onClose: () => void;
  onPostSaved: (post: BlogPostRecord, mode: "create" | "edit") => void;
  post: BlogPostRecord | null;
}) {
  const notify = useNotify();
  const [pending, startSaving] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [pendingUploads, setPendingUploads] = useState<Record<string, boolean>>(
    {},
  );
  const [aiImageFieldId, setAiImageFieldId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const titleFieldId = metadata.logicalFields.title;
  const bodyFieldId = metadata.logicalFields.body;
  const [validationSchema] = useState(() => buildPostInputSchema(metadata));
  const defaultValues: FormValues = {
    slug: post?.slug ?? "",
    fieldValues: Object.fromEntries(
      metadata.fields
        .filter((field) => field.supported)
        .map((field) => [field.id, getDefaultFieldValue(field, post)]),
    ),
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const watchedFieldValues = useWatch({
    control: form.control,
    name: "fieldValues",
  });
  const titleValue = titleFieldId
    ? watchedFieldValues?.[titleFieldId]
    : undefined;
  const supportedFields = metadata.fields.filter((field) => field.supported);
  const readOnlyFields = metadata.fields.filter((field) => !field.supported);
  const titleField = titleFieldId
    ? supportedFields.find((field) => field.id === titleFieldId)
    : undefined;
  const bodyField = bodyFieldId
    ? supportedFields.find((field) => field.id === bodyFieldId)
    : undefined;
  const remainingFields = supportedFields.filter(
    (field) => field.id !== titleField?.id && field.id !== bodyField?.id,
  );
  const nonContentFields = remainingFields.filter(
    (field) => field.type !== "formattedText" && field.logicalKey !== "body",
  );
  const contentFields = remainingFields.filter(
    (field) => field.type === "formattedText" || field.logicalKey === "body",
  );
  const drawerTitle =
    typeof titleValue === "string" && titleValue.trim().length > 0
      ? titleValue.trim()
      : mode === "create"
        ? "Untitled Draft"
        : (post?.title ?? post?.slug ?? "Untitled Entry");
  const statusLabel =
    mode === "create"
      ? "New Draft"
      : form.formState.isDirty
        ? "Unsaved Changes"
        : post?.draft
          ? "Saved Draft"
          : "Published";

  const syncSlugFromTitle = useEffectEvent((value: unknown) => {
    if (
      mode !== "create" ||
      !titleFieldId ||
      typeof value !== "string" ||
      form.getFieldState("slug").isDirty ||
      form.getValues("slug").length > 0
    ) {
      return;
    }

    form.setValue("slug", slugify(value), { shouldValidate: true });
  });

  useEffect(() => {
    syncSlugFromTitle(titleValue);
  }, [titleValue]);

  function resetForm() {
    form.reset(defaultValues);
    setServerError(null);
    setPendingValues(null);
  }

  async function handleAssetUpload(
    field: DashboardFieldDefinition,
    path: `fieldValues.${string}`,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    if (framerUnavailable) {
      notify.error(TRANSIENT_FRAMER_EDITOR_MESSAGE);
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setServerError(null);
    setPendingUploads((current) => ({
      ...current,
      [field.id]: true,
    }));

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", field.type === "image" ? "image" : "file");

      const response = await fetch("/api/uploads", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        error?: string;
        url?: string;
      };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Upload failed.");
      }

      form.setValue(path, data.url, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      notify.success(`${field.name} uploaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setServerError(message);
      notify.error(message);
    } finally {
      setPendingUploads((current) => ({
        ...current,
        [field.id]: false,
      }));
      event.target.value = "";
    }
  }

  function submitValues(values: FormValues) {
    if (framerUnavailable) {
      const message = TRANSIENT_FRAMER_EDITOR_MESSAGE;
      setServerError(message);
      notify.error(message);
      return;
    }

    setServerError(null);
    form.clearErrors();

    startSaving(async () => {
      const endpoint =
        mode === "create" ? "/api/posts" : `/api/posts/${post?.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as {
        error?: string;
        fieldErrors?: Array<{ path: string; message: string }>;
        post?: BlogPostRecord;
      };

      if (!response.ok) {
        const message = data.error ?? "Save failed.";
        for (const fieldError of data.fieldErrors ?? []) {
          if (
            fieldError.path === "slug" ||
            fieldError.path.startsWith("fieldValues.")
          ) {
            form.setError(fieldError.path as Path<FormValues>, {
              type: "server",
              message: fieldError.message,
            });
          }
        }
        setServerError(message);
        notify.error(message);
        return;
      }

      notify.success(
        mode === "create" ? "Draft created." : "Changes saved and published.",
      );

      startTransition(() => {
        if (data.post) {
          onPostSaved(data.post, mode);
          return;
        }

        onClose();
      });
    });
  }

  const submitDraft = form.handleSubmit((values) => {
    submitValues(values);
  });

  const openPublishConfirmation = form.handleSubmit((values) => {
    if (framerUnavailable) {
      const message = TRANSIENT_FRAMER_EDITOR_MESSAGE;
      setServerError(message);
      notify.error(message);
      return;
    }

    setServerError(null);
    setPendingValues(values);
    setConfirmOpen(true);
  });

  function confirmPublish() {
    if (!pendingValues) {
      return;
    }

    const values = pendingValues;
    setConfirmOpen(false);
    setPendingValues(null);
    submitValues(values);
  }

  function renderField(field: DashboardFieldDefinition) {
    const errorMessage = getFieldErrorMessage(
      form.formState.errors.fieldValues,
      field.id,
    );
    const path = `fieldValues.${field.id}` as const;
    const className = cn(
      fieldClassName,
      (isLongTextField(field) || field.type === "array") && wideFieldClassName,
    );
    const inputId = `field-${field.id}`;
    const currentValue = watchedFieldValues?.[field.id] as
      | string
      | string[]
      | boolean
      | undefined;

    if (field.type === "boolean") {
      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => (
              <div className="framer-subtle-panel flex min-h-[42px] items-center justify-between gap-3 px-3">
                <div className="min-w-0">
                  <Label
                    className="text-sm text-[color:var(--framer-fresco-panelTitle-color)]"
                    htmlFor={inputId}
                  >
                    Enabled
                  </Label>
                </div>
                <Checkbox
                  checked={controllerField.value === true}
                  id={inputId}
                  onCheckedChange={(checked) => {
                    controllerField.onChange(checked === true);
                  }}
                />
              </div>
            )}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (field.type === "enum") {
      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => {
              const selectedValue =
                typeof controllerField.value === "string" &&
                controllerField.value.length > 0
                  ? controllerField.value
                  : field.required
                    ? undefined
                    : EMPTY_SELECT_VALUE;

              return (
                <Select
                  onValueChange={(value) => {
                    controllerField.onChange(
                      !field.required && value === EMPTY_SELECT_VALUE
                        ? ""
                        : value,
                    );
                  }}
                  value={selectedValue}
                >
                  <SelectTrigger className={formControlClassName} id={inputId}>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.required ? null : (
                      <SelectItem value={EMPTY_SELECT_VALUE}>
                        No selection
                      </SelectItem>
                    )}
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (
      field.type === "collectionReference" ||
      field.type === "multiCollectionReference"
    ) {
      const referenceOptions = field.referenceCollection?.options ?? [];

      if (field.type === "multiCollectionReference") {
        const selectedValues = Array.isArray(currentValue) ? currentValue : [];

        return (
          <div className={cn(className, wideFieldClassName)} key={field.id}>
            <div className={labelRowClassName}>
              <FieldLabel name={field.name} required={field.required} />
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge className={metaBadgeClassName} variant="secondary">
                  {selectedValues.length} selected
                </Badge>
              </div>
            </div>
            <div className="grid gap-2.5">
              {referenceOptions.map((option) => {
                const optionId = `${inputId}-${option.slug}`;
                const checked = selectedValues.includes(option.slug);

                return (
                  <div
                    className="framer-subtle-panel flex min-h-[42px] items-center justify-between gap-3 px-3"
                    key={option.slug}
                  >
                    <div className="min-w-0">
                      <Label
                        className="text-sm text-[color:var(--framer-fresco-panelTitle-color)]"
                        htmlFor={optionId}
                      >
                        {option.label}
                      </Label>
                      <div className="text-sm text-[color:var(--framer-fresco-panelSubtitle-color)]">
                        {option.slug}
                      </div>
                    </div>
                    <Checkbox
                      checked={checked}
                      id={optionId}
                      onCheckedChange={(nextChecked) => {
                        const nextValue =
                          nextChecked === true
                            ? [...selectedValues, option.slug]
                            : selectedValues.filter(
                                (value) => value !== option.slug,
                              );

                        form.setValue(path, nextValue, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <span className={helperTextClassName}>
              Select the referenced items. Slugs and labels are resolved
              automatically when saving.
            </span>
            {errorMessage ? (
              <span className={fieldErrorClassName}>{errorMessage}</span>
            ) : null}
          </div>
        );
      }

      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => {
              const selectedValue =
                typeof controllerField.value === "string" &&
                controllerField.value.length > 0
                  ? controllerField.value
                  : field.required
                    ? undefined
                    : EMPTY_SELECT_VALUE;

              return (
                <Select
                  onValueChange={(value) => {
                    controllerField.onChange(
                      !field.required && value === EMPTY_SELECT_VALUE
                        ? ""
                        : value,
                    );
                  }}
                  value={selectedValue}
                >
                  <SelectTrigger className={formControlClassName} id={inputId}>
                    <SelectValue
                      placeholder={
                        field.required ? "Select an item" : "No selection"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {field.required ? null : (
                      <SelectItem value={EMPTY_SELECT_VALUE}>
                        No selection
                      </SelectItem>
                    )}
                    {referenceOptions.map((option) => (
                      <SelectItem key={option.slug} value={option.slug}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }}
          />
          <span className={helperTextClassName}>
            Select the referenced item. Slugs and labels are resolved
            automatically when saving.
          </span>
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (field.type === "formattedText") {
      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel name={field.name} required={field.required} />
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => (
              <RichTextInput
                rewriteContext={{
                  title: typeof titleValue === "string" ? titleValue : undefined,
                  slug: form.getValues("slug") || undefined,
                }}
                onChange={controllerField.onChange}
                placeholder={`Write ${field.name.toLowerCase()}`}
                value={
                  typeof controllerField.value === "string"
                    ? controllerField.value
                    : ""
                }
              />
            )}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (field.type === "image" || field.type === "file") {
      const assetUrl = typeof currentValue === "string" ? currentValue : "";
      const isUploading = pendingUploads[field.id] === true;
      const uploadId = `${inputId}-upload`;

      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <div className="flex flex-col gap-3">
            {assetUrl ? (
              <div className="framer-elevated-panel flex items-center gap-3 rounded-lg p-3">
                {field.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={field.name}
                    className="h-[80px] w-28 shrink-0 rounded-lg border border-[var(--framer-fresco-panelDivider-color)] object-cover"
                    src={assetUrl}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--framer-app-surface-muted-color)] text-[color:var(--framer-fresco-settingsText-color)]"
                  >
                    <svg
                      fill="none"
                      height="22"
                      viewBox="0 0 22 22"
                      width="22"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6.5 2.75H12.375L16.5 6.875V17.125C16.5 18.1605 15.6605 19 14.625 19H7.375C6.33947 19 5.5 18.1605 5.5 17.125V3.75C5.5 3.19772 5.94772 2.75 6.5 2.75Z"
                        fill="currentColor"
                        fillOpacity="0.12"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M12 2.75V7.25H16.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <strong className="truncate text-[color:var(--framer-fresco-panelTitle-color)]">
                    {getAssetLabel(assetUrl)}
                  </strong>
                  <div className="flex items-center gap-1.5">
                    <Button
                      asChild
                      className="h-7 rounded-lg px-2.5 text-xs"
                      size="sm"
                      variant="outline"
                    >
                      <label htmlFor={uploadId}>
                        <input
                          accept={
                            field.type === "image" ? "image/*" : undefined
                          }
                          hidden
                          id={uploadId}
                          onChange={(event) => {
                            void handleAssetUpload(field, path, event);
                          }}
                          type="file"
                        />
                        {isUploading ? "Uploading..." : "Replace"}
                      </label>
                    </Button>
                    {!field.required ? (
                      <Button
                        className="h-7 rounded-lg px-2.5 text-xs"
                        onClick={() => {
                          form.setValue(path, "", {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Remove
                      </Button>
                    ) : null}
                    {field.type === "image" ? (
                      <Button
                        className="h-7 rounded-lg px-2.5 text-xs"
                        onClick={() => setAiImageFieldId(field.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Sparkle className="size-3.5" weight="duotone" />
                        AI
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <Input
                className={formControlClassName}
                id={inputId}
                placeholder={field.name}
                {...form.register(path)}
              />
            )}
            {!assetUrl ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  asChild
                  className="h-9 rounded-lg px-3"
                  size="sm"
                  variant="outline"
                >
                  <label htmlFor={uploadId}>
                    <input
                      accept={field.type === "image" ? "image/*" : undefined}
                      hidden
                      id={uploadId}
                      onChange={(event) => {
                        void handleAssetUpload(field, path, event);
                      }}
                      type="file"
                    />
                    {isUploading ? "Uploading..." : "Upload"}
                  </label>
                </Button>
                {field.type === "image" ? (
                  <Button
                    className="h-9 rounded-lg px-3"
                    onClick={() => setAiImageFieldId(field.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Sparkle className="size-4" weight="duotone" />
                    Generate Image
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (isLongTextField(field)) {
      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <Textarea
            className={cn(formControlClassName, "min-h-[160px] resize-y")}
            id={inputId}
            placeholder={field.name}
            rows={field.id === bodyField?.id ? 8 : 4}
            {...form.register(path)}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    return (
      <div className={className} key={field.id}>
        <div className={labelRowClassName}>
          <FieldLabel
            htmlFor={inputId}
            name={field.name}
            required={field.required}
          />
        </div>
        <Input
          className={cn(
            formControlClassName,
            field.id === titleField?.id && titleControlClassName,
          )}
          id={inputId}
          placeholder={field.name}
          type={
            field.type === "number"
              ? "number"
              : field.type === "date"
                ? field.displayTime
                  ? "datetime-local"
                  : "date"
                : "text"
          }
          {...form.register(path)}
        />
        {field.helpText ? (
          <span className={helperTextClassName}>{field.helpText}</span>
        ) : null}
        {errorMessage ? (
          <span className={fieldErrorClassName}>{errorMessage}</span>
        ) : null}
      </div>
    );
  }

  return (
    <section className="flex h-full flex-col bg-[var(--framer-fresco-panelBackground-color)]">
      <div className="sticky top-0 z-10 border-b border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] px-5 py-4 ">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Button
              aria-label="Close editor"
              className="framer-elevated-panel size-10 rounded-lg text-[color:var(--framer-fresco-settingsText-color)]"
              onClick={onClose}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <svg
                fill="none"
                height="18"
                viewBox="0 0 18 18"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.5 4.5L13.5 13.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.4"
                />
                <path
                  d="M13.5 4.5L4.5 13.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.4"
                />
              </svg>
            </Button>
            <div
              aria-hidden="true"
              className="hidden h-[34px] w-px bg-[var(--framer-fresco-panelDivider-color)] sm:block"
            />
            <div className="min-w-0 max-w-[720px]">
              <span className="text-sm font-medium tracking-[0.12em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
                {mode === "create" ? "Create Post" : "Edit Post"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 max-md:w-full">
            <Badge
              className={cn(
                "relative h-[34px] rounded-full border px-3 pl-6 text-[11px] font-bold uppercase tracking-[0.08em] before:absolute before:top-1/2 before:left-2.5 before:size-[7px] before:-translate-y-1/2 before:rounded-full before:bg-current",
                form.formState.isDirty
                  ? "framer-status-pill framer-status-pill-draft"
                  : "framer-status-pill framer-status-pill-idle",
              )}
              variant="outline"
            >
              {statusLabel}
            </Badge>
            {form.formState.isDirty ? (
              <Button
                disabled={pending || framerUnavailable}
                onClick={resetForm}
                size="lg"
                type="button"
                variant="outline"
              >
                Reset
              </Button>
            ) : null}
            {mode === "create" ? (
              <Button
                className={primaryButtonClassName}
                disabled={pending || framerUnavailable}
                onClick={submitDraft}
                size="lg"
                type="button"
              >
                {pending ? "Saving..." : "Create Draft"}
              </Button>
            ) : (
              <Button
                className={primaryButtonClassName}
                disabled={
                  pending || framerUnavailable || !form.formState.isDirty
                }
                onClick={openPublishConfirmation}
                size="lg"
                type="button"
              >
                {pending ? "Publishing..." : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {serverError ? (
        <div className="framer-callout-danger mx-6 mt-4" role="alert">
          {serverError}
        </div>
      ) : null}

      {framerUnavailable ? (
        <div className={cn(warningBannerClassName, "mx-6 mt-4")} role="status">
          Framer Server API is temporarily unavailable. FramerBot is still
          working and your content is safe. You can review cached content here,
          but editing and publishing are disabled until the connection recovers.
        </div>
      ) : null}

      <form
        className="flex flex-1 flex-col gap-4 overflow-auto px-4 pt-5 pb-8 md:px-6 md:pb-10"
        onSubmit={
          mode === "create" ? submitDraft : (event) => event.preventDefault()
        }
      >
        <fieldset className="contents" disabled={framerUnavailable}>
          <div className="flex max-w-[840px] flex-col gap-4">
            {titleField ? renderField(titleField) : null}

            <div className={fieldClassName}>
              <div className={labelRowClassName}>
                <FieldLabel htmlFor="post-slug" name="Slug" required />
              </div>
              <Input
                className={formControlClassName}
                id="post-slug"
                placeholder="my-new-post"
                {...form.register("slug")}
              />
              {form.formState.errors.slug ? (
                <span className={fieldErrorClassName}>
                  {form.formState.errors.slug.message}
                </span>
              ) : null}
            </div>

            {nonContentFields.map((field) => renderField(field))}
            {bodyField && bodyField.id !== titleField?.id
              ? renderField(bodyField)
              : null}
            {contentFields.map((field) => renderField(field))}

            {readOnlyFields.length > 0 ? (
              <section className="framer-subtle-panel mt-2 flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-1.5">
                  <span className="framer-kicker w-fit">
                    Read Only In Dashboard
                  </span>
                  <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
                    These fields are still part of the Framer schema but are not
                    editable here.
                  </p>
                </div>
                <div className="flex max-w-[840px] flex-col gap-4">
                  {readOnlyFields.map((field) => (
                    <ReadOnlyField
                      field={field}
                      key={field.id}
                      value={post?.fieldValues[field.id] ?? ""}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </fieldset>
      </form>

      <Dialog
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setPendingValues(null);
          }
        }}
        open={mode === "edit" && confirmOpen}
      >
        <DialogContent
          className="framer-dialog-panel rounded-none border"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle id="publish-confirm-title">
              Publish these changes?
            </DialogTitle>
            <DialogDescription id="publish-confirm-description">
              This will push your edits live in Framer immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-0 -mb-0 flex justify-end gap-2.5 rounded-none border-0 bg-transparent p-0">
            <Button
              disabled={pending || framerUnavailable}
              onClick={() => {
                setConfirmOpen(false);
                setPendingValues(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className={primaryButtonClassName}
              disabled={pending || framerUnavailable}
              onClick={confirmPublish}
              type="button"
            >
              {pending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Image Generation Dialog — image fields */}
      <AIImageDialog
        context={{
          title: typeof titleValue === "string" ? titleValue : undefined,
          slug: form.getValues("slug") || undefined,
        }}
        defaultPrompt=""
        onAccept={(imageUrl) => {
          if (aiImageFieldId) {
            const fieldPath = `fieldValues.${aiImageFieldId}` as const;
            form.setValue(fieldPath, imageUrl, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
            notify.success("AI image applied.");
          }
        }}
        onOpenChange={(open) => {
          if (!open) setAiImageFieldId(null);
        }}
        open={aiImageFieldId !== null}
        referenceImageUrl={
          aiImageFieldId &&
          typeof watchedFieldValues?.[aiImageFieldId] === "string" &&
          (watchedFieldValues[aiImageFieldId] as string).length > 0
            ? (watchedFieldValues[aiImageFieldId] as string)
            : undefined
        }
      />

    </section>
  );
}
