import { TRANSIENT_FRAMER_MESSAGE_PATTERNS } from "@/lib/framer-errors";

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

