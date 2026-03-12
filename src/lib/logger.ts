type LogLevel = "info" | "warn" | "error";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  };
}

export function logEvent(
  level: LogLevel,
  event: string,
  metadata: Record<string, unknown> = {},
) {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      ...metadata,
    }),
  );
}

export function logError(
  event: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
) {
  logEvent("error", event, {
    ...metadata,
    error: serializeError(error),
  });
}
