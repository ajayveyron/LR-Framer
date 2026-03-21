/**
 * Pure functions for managing row selection state in the dashboard table.
 *
 * Every function returns a **new** Set — no mutation of the input.
 */

/**
 * Toggle a single row in the selection.
 * If the row is selected it gets removed; if absent it gets added.
 * Toggling twice returns to the original state (involution).
 *
 * @see Requirement 1.3
 */
export function toggleRow(
  selection: Set<string>,
  rowId: string,
): Set<string> {
  const next = new Set(selection);
  if (next.has(rowId)) {
    next.delete(rowId);
  } else {
    next.add(rowId);
  }
  return next;
}

/**
 * Header-checkbox logic: if the selection is empty, select all visible rows;
 * otherwise clear the entire selection.
 *
 * @see Requirements 1.4, 1.5
 */
export function toggleAllRows(
  selection: Set<string>,
  visibleRowIds: string[],
): Set<string> {
  if (selection.size === 0) {
    return new Set(visibleRowIds);
  }
  return new Set<string>();
}

/**
 * Shift-click range selection: add every row between `lastIndex` and
 * `clickedIndex` (inclusive) to the selection.
 *
 * @see Requirement 1.9
 */
export function shiftClickRange(
  selection: Set<string>,
  visibleRowIds: string[],
  lastIndex: number,
  clickedIndex: number,
): Set<string> {
  const lo = Math.min(lastIndex, clickedIndex);
  const hi = Math.max(lastIndex, clickedIndex);
  const next = new Set(selection);
  for (let i = lo; i <= hi; i++) {
    const id = visibleRowIds[i];
    if (id !== undefined) {
      next.add(id);
    }
  }
  return next;
}
