/**
 * Lowercase message substrings that indicate a transient Framer connection
 * issue. Duplicated from `framer-errors.ts` because this module is imported
 * by client components and must not pull in the server-only `framer-api` package.
 */
const TRANSIENT_FRAMER_MESSAGE_PATTERNS = [
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

  return TRANSIENT_FRAMER_MESSAGE_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

