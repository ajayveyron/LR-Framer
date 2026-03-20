import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors";
import type { AppErrorField } from "@/lib/errors";
import { TRANSIENT_FRAMER_SHORT_MESSAGE } from "@/lib/framer-copy";
import { isTransientFramerError } from "@/lib/framer-errors";

type FramerApiErrorLike = {
  code?: string;
  message?: string;
  name?: string;
};

function isFramerApiError(error: unknown): error is FramerApiErrorLike {
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      "code" in error &&
      (typeof (error as FramerApiErrorLike).code === "string" ||
        typeof (error as FramerApiErrorLike).code === "undefined"),
  );
}

function getStatusFromFramerError(error: FramerApiErrorLike) {
  switch (error.code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_REQUEST":
      return 400;
    case "NODE_NOT_FOUND":
      return 404;
    default:
      return 502;
  }
}

function mapIssuePath(path: PropertyKey[]) {
  return path.map((segment) => String(segment)).join(".") || "error";
}

function getFieldErrors(error: ZodError): AppErrorField[] {
  return error.issues.map((issue) => ({
    path: mapIssuePath(issue.path),
    message: issue.message,
  }));
}

export function getErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      message: error.message,
      status: error.status,
      fieldErrors: error.fieldErrors,
    };
  }

  if (error instanceof ZodError) {
    const fieldErrors = getFieldErrors(error);
    return {
      message: fieldErrors[0]?.message ?? "Invalid request payload.",
      status: 400,
      fieldErrors,
    };
  }

  if (isFramerApiError(error)) {
    if (isTransientFramerError(error)) {
      return {
        message: TRANSIENT_FRAMER_SHORT_MESSAGE,
        status: 503,
      };
    }

    return {
      message: error.message ?? "Framer request failed.",
      status: getStatusFromFramerError(error),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || "Unexpected server error.",
      status: 500,
    };
  }

  return {
    message: "Unexpected server error.",
    status: 500,
  };
}

export function createErrorJsonResponse(error: unknown) {
  const mapped = getErrorResponse(error);
  return NextResponse.json(
    {
      error: mapped.message,
      fieldErrors: mapped.fieldErrors,
    },
    { status: mapped.status },
  );
}
