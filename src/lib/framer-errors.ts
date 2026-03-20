import { ErrorCode, FramerAPIError, isRetryableError } from "framer-api";

import { AppError } from "@/lib/errors";
import { TRANSIENT_FRAMER_SHORT_MESSAGE } from "@/lib/framer-copy";

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

export function toTransientFramerAppError(error: unknown) {
  if (!isTransientFramerError(error)) {
    return error;
  }

  return new AppError(
    TRANSIENT_FRAMER_SHORT_MESSAGE,
    503,
  );
}
