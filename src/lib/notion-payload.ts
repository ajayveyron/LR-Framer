function extractStringId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function extractPageIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  return (
    extractStringId(record.pageId) ??
    extractStringId(record.page_id) ??
    (record.page && typeof record.page === "object"
      ? extractStringId((record.page as Record<string, unknown>).id)
      : null) ??
    (record.data && typeof record.data === "object"
      ? extractStringId((record.data as Record<string, unknown>).id)
      : null) ??
    (record.entity && typeof record.entity === "object"
      ? extractStringId((record.entity as Record<string, unknown>).id)
      : null)
  );
}
