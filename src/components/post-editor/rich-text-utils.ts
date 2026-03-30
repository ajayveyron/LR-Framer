import { looksLikeHtml } from "@/lib/shared-utils";

// ── Types ──

export type RichTextBlockType = "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type MarkdownShortcut =
  | {
      command: "formatBlock";
      commandValue: string;
      nextBlockType: RichTextBlockType;
    }
  | { command: "formatBlock"; commandValue: "<blockquote>" | "<pre>" }
  | { command: "insertUnorderedList" | "insertOrderedList" };

// ── Constants ──

export const richTextBlockOptions: Array<{
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

export const ALLOWED_EDITOR_TAGS = new Set([
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
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

export const STRIP_CONTENT_TAGS = new Set([
  "iframe",
  "object",
  "script",
  "style",
  "svg",
]);

// ── Functions ──

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeLinkHref(value: string) {
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

export function sanitizeEditorHtml(html: string) {
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

export function toEditorHtml(value: string) {
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

export function getActiveBlockType(
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

export function getEditorBlockElement(
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

export function getEditorSelectionRange(editor: HTMLDivElement | null) {
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

export function getMarkdownShortcut(value: string): MarkdownShortcut | null {
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

export function normalizeLinkUrl(value: string) {
  return sanitizeLinkHref(value);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
