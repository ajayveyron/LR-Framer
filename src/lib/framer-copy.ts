const TRANSIENT_FRAMER_PATTERNS = [
  "no connection to the server",
  "connection to the server was closed",
  "framer is temporarily unavailable",
  "framer server api is temporarily unavailable",
  "server api is temporarily unavailable",
  "service unavailable",
  "bad gateway",
  "gateway timeout",
  "session expired",
  "timed out",
  "timeout",
  "project_closed",
];

export const TRANSIENT_FRAMER_SHORT_MESSAGE =
  "Framer Server API is temporarily unavailable. FramerBot is still working and your content is safe.";

export const TRANSIENT_FRAMER_EDITOR_MESSAGE =
  "Framer Server API is temporarily unavailable. FramerBot is still working, and your content and data are safe.";

export function isTransientFramerMessage(message: string) {
  const normalized = message.toLowerCase();

  return TRANSIENT_FRAMER_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function getFramerStatusDetail({
  cachedLabel,
  state,
}: {
  cachedLabel: string | null;
  state: "stale" | "unavailable";
}) {
  if (state === "stale") {
    if (cachedLabel) {
      return `FramerBot is still working, your content and data are safe, and you're viewing the last cached dashboard snapshot from ${cachedLabel}. Editing and publishing are paused until Framer recovers.`;
    }

    return "FramerBot is still working, your content and data are safe, and you're viewing the last cached dashboard snapshot. Editing and publishing are paused until Framer recovers.";
  }

  return "FramerBot is still working, and your content and data are safe. Editing and publishing are paused until the Framer Server API recovers.";
}
