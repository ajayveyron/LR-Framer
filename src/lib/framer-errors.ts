import { ErrorCode, FramerAPIError, isRetryableError } from "framer-api";

type FramerErrorLike = {
  code?: string;
  message?: string;
};

function isFramerErrorLike(error: unknown): error is FramerErrorLike {
  return Boolean(
    error &&
      typeof error === "object" &&
      ("code" in error || "message" in error),
  );
}

function getFramerErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isFramerErrorLike(error) && typeof error.message === "string") {
    return error.message;
  }

  return "";
}

function getFramerErrorCode(error: unknown) {
  if (error instanceof FramerAPIError) {
    return error.code;
  }

  if (isFramerErrorLike(error) && typeof error.code === "string") {
    return error.code;
  }

  return undefined;
}

const TRANSIENT_FRAMER_CODES = new Set<string>([
  ErrorCode.POOL_EXHAUSTED,
  ErrorCode.PROJECT_CLOSED,
  ErrorCode.TIMEOUT,
]);

/**
 * Lowercase message substrings that indicate a transient Framer connection
 * issue. Shared between server-side error detection (`framer-errors.ts`) and
 * client-side message matching (`framer-copy.ts`).
 */
export const TRANSIENT_FRAMER_MESSAGE_PATTERNS = [
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

export function isTransientFramerError(error: unknown) {
  const code = getFramerErrorCode(error);
  const message = getFramerErrorMessage(error).toLowerCase();

  return (
    isRetryableError(error) ||
    (typeof code === "string" && TRANSIENT_FRAMER_CODES.has(code)) ||
    TRANSIENT_FRAMER_MESSAGE_PATTERNS.some((pattern) =>
      message.includes(pattern),
    )
  );
}
