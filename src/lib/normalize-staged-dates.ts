import type { BlogCollectionMetadata, DashboardFieldValue } from "@/lib/cms-types";

/**
 * Normalize date field values in a staged item's fieldValues so they match
 * Framer's required ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
 *
 * AI-generated dates may arrive in various formats (e.g. "2025-03-15",
 * "2025-03-15T10:30", "March 15, 2025"). This normalizer converts them all
 * to the full ISO string that Framer CMS expects.
 */
export function normalizeStagedDates(
  fieldValues: Record<string, DashboardFieldValue>,
  metadata: BlogCollectionMetadata,
): Record<string, DashboardFieldValue> {
  const result = { ...fieldValues };

  for (const field of metadata.fields) {
    if (field.type !== "date") continue;

    const raw = result[field.id];
    if (typeof raw !== "string" || !raw) continue;

    const d = new Date(raw);
    if (Number.isNaN(d.valueOf())) continue;

    // Framer requires full ISO 8601: YYYY-MM-DDTHH:mm:ss.sssZ
    if (field.displayTime) {
      // For date+time fields, already-valid ISO strings pass through;
      // everything else gets converted.
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) continue;
      result[field.id] = d.toISOString();
    } else {
      // Date-only: always normalize to midnight UTC regardless of input
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      result[field.id] = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
    }
  }

  return result;
}
