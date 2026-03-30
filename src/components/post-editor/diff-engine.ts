import { sanitizeEditorHtml } from "./rich-text-utils";

// ── Types ──

export interface DiffSegment {
  type: "unchanged" | "removed" | "added";
  text: string;
}

// ── Functions ──

export function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = sanitizeEditorHtml(html);
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function computeWordDiff(oldText: string, newText: string): DiffSegment[] {
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
