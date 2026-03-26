/**
 * Normalize AI-generated fieldData values so they match what the Framer API
 * expects. The AI sometimes sends wrong value types (e.g. a number for a
 * string field, or a slug for a reference field).
 */
export function normalizeFieldData(
  fieldData: Record<string, { type: string; value: unknown }>,
): Record<string, { type: string; value: unknown }> {
  const result: Record<string, { type: string; value: unknown }> = {};
  for (const [fieldId, entry] of Object.entries(fieldData)) {
    if (!entry || typeof entry !== "object" || !("type" in entry)) continue;
    const { type, value } = entry;
    switch (type) {
      case "string":
      case "link":
      case "color":
        result[fieldId] = { type, value: value != null ? String(value) : null };
        break;
      case "formattedText":
        result[fieldId] = {
          type,
          value: value != null ? String(value) : null,
          ...("contentType" in entry ? { contentType: (entry as Record<string, unknown>).contentType } : {}),
        } as { type: string; value: unknown };
        break;
      case "number":
        result[fieldId] = { type, value: value != null ? Number(value) : null };
        break;
      case "boolean":
        result[fieldId] = { type, value: value != null ? Boolean(value) : null };
        break;
      case "image": {
        if (value && typeof value === "object" && "url" in (value as Record<string, unknown>)) {
          result[fieldId] = { type, value: (value as Record<string, unknown>).url ?? null };
        } else {
          result[fieldId] = { type, value: value != null ? String(value) : null };
        }
        break;
      }
      case "file":
        result[fieldId] = { type, value: value != null ? String(value) : null };
        break;
      case "date":
        result[fieldId] = { type, value: value != null ? String(value) : null };
        break;
      case "enum":
        result[fieldId] = { type, value: value != null ? String(value) : null };
        break;
      case "collectionReference":
        result[fieldId] = { type, value: value != null ? String(value) : null };
        break;
      case "multiCollectionReference":
        result[fieldId] = { type, value: Array.isArray(value) ? value.map(String) : [] };
        break;
      default:
        result[fieldId] = entry;
        break;
    }
  }
  return result;
}
