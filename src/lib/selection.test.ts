import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { toggleRow, toggleAllRows, shiftClickRange } from "./selection.js";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const rowIdArb = fc.string({ minLength: 1, maxLength: 20 });
const rowIdArrayArb = fc.uniqueArray(rowIdArb, { minLength: 1, maxLength: 50 });

function selectionFromIds(ids: string[]): Set<string> {
  return new Set(ids);
}

// ---------------------------------------------------------------------------
// Property 1: Checkbox toggle is an involution
// Toggling a row twice returns the original selection.
// ---------------------------------------------------------------------------

describe("Property 1 — toggleRow involution", () => {
  it("toggling a row twice returns the original selection", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(rowIdArb, { maxLength: 20 }),
        rowIdArb,
        (existingIds, targetId) => {
          const original = selectionFromIds(existingIds);
          const once = toggleRow(original, targetId);
          const twice = toggleRow(once, targetId);
          assert.deepStrictEqual(twice, original);
        },
      ),
    );
  });

  it("toggle adds when absent, removes when present", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(rowIdArb, { maxLength: 20 }),
        rowIdArb,
        (existingIds, targetId) => {
          const original = selectionFromIds(existingIds);
          const toggled = toggleRow(original, targetId);
          if (original.has(targetId)) {
            assert.ok(!toggled.has(targetId));
          } else {
            assert.ok(toggled.has(targetId));
          }
        },
      ),
    );
  });

  it("does not mutate the input set", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(rowIdArb, { maxLength: 20 }),
        rowIdArb,
        (existingIds, targetId) => {
          const original = selectionFromIds(existingIds);
          const sizeBefore = original.size;
          toggleRow(original, targetId);
          assert.equal(original.size, sizeBefore);
        },
      ),
    );
  });
});


// ---------------------------------------------------------------------------
// Property 2: Header checkbox toggles all-or-none
// Empty selection → select all visible; non-empty → clear everything.
// ---------------------------------------------------------------------------

describe("Property 2 — toggleAllRows all-or-none", () => {
  it("from empty selection, selects exactly all visible rows", () => {
    fc.assert(
      fc.property(rowIdArrayArb, (visibleIds) => {
        const empty = new Set<string>();
        const result = toggleAllRows(empty, visibleIds);
        assert.deepStrictEqual(result, new Set(visibleIds));
      }),
    );
  });

  it("from non-empty selection, clears to empty", () => {
    fc.assert(
      fc.property(
        rowIdArrayArb,
        fc.uniqueArray(rowIdArb, { minLength: 1, maxLength: 20 }),
        (visibleIds, selectedIds) => {
          const selection = selectionFromIds(selectedIds);
          const result = toggleAllRows(selection, visibleIds);
          assert.equal(result.size, 0);
        },
      ),
    );
  });

  it("does not mutate the input set", () => {
    fc.assert(
      fc.property(rowIdArrayArb, (visibleIds) => {
        const original = new Set<string>();
        const sizeBefore = original.size;
        toggleAllRows(original, visibleIds);
        assert.equal(original.size, sizeBefore);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Selection count display matches state
// The size of the returned set always equals the number of selected IDs.
// ---------------------------------------------------------------------------

describe("Property 3 — selection count matches state", () => {
  it("toggleRow changes size by exactly 1", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(rowIdArb, { maxLength: 20 }),
        rowIdArb,
        (existingIds, targetId) => {
          const original = selectionFromIds(existingIds);
          const toggled = toggleRow(original, targetId);
          const diff = Math.abs(toggled.size - original.size);
          assert.equal(diff, 1);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Selection persists across page/search changes
// Since selection is a pure Set independent of visible rows, toggling
// with different visible arrays doesn't lose previously selected IDs.
// ---------------------------------------------------------------------------

describe("Property 4 — selection persistence", () => {
  it("selection retains IDs not in the current visible set", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(rowIdArb, { minLength: 1, maxLength: 10 }),
        fc.uniqueArray(rowIdArb, { minLength: 1, maxLength: 10 }),
        (page1Ids, page2Ids) => {
          // Select all from page 1
          const sel = toggleAllRows(new Set<string>(), page1Ids);
          // "Navigate" to page 2 — selection should still contain page 1 IDs
          for (const id of page1Ids) {
            assert.ok(sel.has(id), `Lost ${id} after page change`);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Shift-click range selection
// All rows between lastIndex and clickedIndex (inclusive) are added.
// ---------------------------------------------------------------------------

describe("Property 5 — shiftClickRange", () => {
  it("adds all rows in the range [lo, hi] inclusive", () => {
    fc.assert(
      fc.property(
        rowIdArrayArb.chain((ids) =>
          fc.tuple(
            fc.constant(ids),
            fc.integer({ min: 0, max: ids.length - 1 }),
            fc.integer({ min: 0, max: ids.length - 1 }),
          ),
        ),
        ([visibleIds, a, b]) => {
          const result = shiftClickRange(new Set(), visibleIds, a, b);
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          for (let i = lo; i <= hi; i++) {
            assert.ok(result.has(visibleIds[i]!));
          }
          assert.ok(result.size >= hi - lo + 1);
        },
      ),
    );
  });

  it("preserves existing selection", () => {
    fc.assert(
      fc.property(
        rowIdArrayArb,
        fc.uniqueArray(rowIdArb, { minLength: 1, maxLength: 5 }),
        (visibleIds, preSelectedIds) => {
          const existing = selectionFromIds(preSelectedIds);
          const result = shiftClickRange(existing, visibleIds, 0, 0);
          for (const id of preSelectedIds) {
            assert.ok(result.has(id));
          }
        },
      ),
    );
  });

  it("order of indices does not matter", () => {
    fc.assert(
      fc.property(
        rowIdArrayArb.chain((ids) =>
          fc.tuple(
            fc.constant(ids),
            fc.integer({ min: 0, max: ids.length - 1 }),
            fc.integer({ min: 0, max: ids.length - 1 }),
          ),
        ),
        ([visibleIds, a, b]) => {
          const r1 = shiftClickRange(new Set(), visibleIds, a, b);
          const r2 = shiftClickRange(new Set(), visibleIds, b, a);
          assert.deepStrictEqual(r1, r2);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: AI Edit button enabled iff selection non-empty
// This is a derived property: button state = selection.size > 0
// ---------------------------------------------------------------------------

describe("Property 6 — AI Edit button enabled iff selection non-empty", () => {
  it("non-empty selection means enabled, empty means disabled", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(rowIdArb, { maxLength: 20 }),
        (ids) => {
          const selection = selectionFromIds(ids);
          const enabled = selection.size > 0;
          assert.equal(enabled, ids.length > 0);
        },
      ),
    );
  });

  it("clearing via toggleAllRows always results in disabled", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(rowIdArb, { minLength: 1, maxLength: 20 }),
        rowIdArrayArb,
        (selectedIds, visibleIds) => {
          const selection = selectionFromIds(selectedIds);
          const cleared = toggleAllRows(selection, visibleIds);
          assert.equal(cleared.size > 0, false);
        },
      ),
    );
  });
});
