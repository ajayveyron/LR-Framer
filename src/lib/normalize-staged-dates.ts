import type { BlogCollectionMetadata, DashboardFieldValue } from "@/lib/cms-types";

/**
 * Normalize date field values in a staged item's fieldValues so they match
 * the format expected by the post schema validation:
 * - Date-only fields: YYYY-MM-DD
 * - Date+time fields: YYYY-MM-DDTHH:mm
 *
 * AI-generated dates often arrive as full ISO strings (e.g. "2025-03-15T10:30:00.000Z")
 * which fail the strict regex in post-schema.ts.
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

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    if (field.displayTime) {
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      result[field.id] = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    } else {
      result[field.id] = `${yyyy}-${mm}-${dd}`;
    }
  }

  return result;
}
