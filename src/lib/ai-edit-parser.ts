import type { DashboardFieldValue } from "@/lib/cms-types";

/**
 * A single field change within a row edit proposal.
 */
export interface FieldChange {
  fieldName: string;
  currentValue: DashboardFieldValue;
  proposedValue: DashboardFieldValue;
}

/**
 * A proposed edit for one CMS row, as returned by the `propose_edits` tool.
 */
export interface ProposedEdit {
  rowId: string;
  changes: Record<string, FieldChange>;
}

/**
 * Extracts `ProposedEdit[]` from a `propose_edits` tool invocation result.
 *
 * Accepts the `args` object from a `useChat` tool invocation where
 * `toolName === "propose_edits"`. Returns an empty array if the shape
 * is unexpected so the UI can degrade gracefully.
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

    const parsedChanges: Record<string, FieldChange> = {};

    for (const [fieldId, change] of Object.entries(
      changes as Record<string, unknown>,
    )) {
      if (!change || typeof change !== "object") {
        continue;
      }

      const c = change as Record<string, unknown>;
      parsedChanges[fieldId] = {
        fieldName: typeof c.fieldName === "string" ? c.fieldName : fieldId,
        currentValue: c.currentValue as DashboardFieldValue,
        proposedValue: c.proposedValue as DashboardFieldValue,
      };
    }

    if (Object.keys(parsedChanges).length > 0) {
      result.push({ rowId, changes: parsedChanges });
    }
  }

  return result;
}
