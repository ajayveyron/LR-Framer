import type { DashboardFieldValue } from "@/lib/cms-types";

/**
 * A proposed edit for one CMS row, as returned by the `propose_edits` tool.
 * `changes` maps fieldId → new value directly (simplified format).
 */
export interface ProposedEdit {
  rowId: string;
  changes: Record<string, DashboardFieldValue>;
}

/**
 * Extracts `ProposedEdit[]` from a `propose_edits` tool invocation result.
 *
 * The model sends a simplified format: `changes: { fieldId: newValue }`.
 * Returns an empty array if the shape is unexpected so the UI degrades gracefully.
 */
export function parseEditProposals(args: unknown): ProposedEdit[] {
  if (!args || typeof args !== "object") {
    return [];
  }

  const obj = args as Record<string, unknown>;
  const edits = obj.edits;

  if (!Array.isArray(edits)) {
    return [];
  }

  const result: ProposedEdit[] = [];

  for (const entry of edits) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const { rowId, changes } = entry as Record<string, unknown>;

    if (typeof rowId !== "string" || !changes || typeof changes !== "object") {
      continue;
    }

    const parsedChanges: Record<string, DashboardFieldValue> = {};

    for (const [fieldId, value] of Object.entries(
      changes as Record<string, unknown>,
    )) {
      // Accept any primitive or array value the model sends
      parsedChanges[fieldId] = value as DashboardFieldValue;
    }

    if (Object.keys(parsedChanges).length > 0) {
      result.push({ rowId, changes: parsedChanges });
    }
  }

  return result;
}
