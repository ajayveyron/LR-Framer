import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { parseEditProposals } from "./ai-edit-parser.js";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const fieldValueArb = fc.oneof(
  fc.string({ maxLength: 100 }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
);

const fieldChangeArb = fieldValueArb;

const fieldIdArb = fc.string({ minLength: 1, maxLength: 20 });

const changesArb = fc
  .uniqueArray(fieldIdArb, { minLength: 1, maxLength: 5 })
  .chain((fieldIds) =>
    fc.tuple(...fieldIds.map(() => fieldChangeArb)).map((values) => {
      const record: Record<string, unknown> = {};
      fieldIds.forEach((id, i) => {
        record[id] = values[i];
      });
      return record;
    }),
  );

const proposedEditArb = fc.record({
  rowId: fc.string({ minLength: 1, maxLength: 30 }),
  changes: changesArb,
});

const editsArrayArb = fc.array(proposedEditArb, { minLength: 1, maxLength: 10 });

// ---------------------------------------------------------------------------
// Property 8: Edit proposal JSON round-trip parsing
// Structured tool args → parseEditProposals → same data back.
// ---------------------------------------------------------------------------

describe("Property 8 — edit proposal JSON round-trip", () => {
  it("round-trips valid propose_edits args", () => {
    fc.assert(
      fc.property(editsArrayArb, (edits) => {
        const args = { edits };
        const parsed = parseEditProposals(args);

        assert.equal(parsed.length, edits.length);

        for (let i = 0; i < edits.length; i++) {
          const original = edits[i]!;
          const result = parsed[i]!;
          assert.equal(result.rowId, original.rowId);
          assert.deepStrictEqual(
            Object.keys(result.changes).sort(),
            Object.keys(original.changes).sort(),
          );

          for (const [fieldId, value] of Object.entries(result.changes)) {
            const orig = original.changes[fieldId];
            assert.deepStrictEqual(value, orig);
          }
        }
      }),
    );
  });
});


// ---------------------------------------------------------------------------
// Property 9: Change preview completeness
// Every field change in the input appears in the parsed output — nothing lost.
// ---------------------------------------------------------------------------

describe("Property 9 — change preview completeness", () => {
  it("every field change in input appears in output", () => {
    // Use edits with unique rowIds and at least one change each
    const uniqueEditsArb = fc
      .uniqueArray(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 })
      .chain((rowIds) =>
        fc.tuple(...rowIds.map((rowId) => changesArb.map((changes) => ({ rowId, changes })))),
      );

    fc.assert(
      fc.property(uniqueEditsArb, (edits) => {
        const parsed = parseEditProposals({ edits });

        // Only check entries that have non-empty changes (parser skips empty)
        for (const original of edits) {
          if (Object.keys(original.changes).length === 0) continue;
          const match = parsed.find((p) => p.rowId === original.rowId);
          assert.ok(match, `Missing row ${original.rowId}`);

          for (const fieldId of Object.keys(original.changes)) {
            assert.ok(
              fieldId in match.changes,
              `Missing field ${fieldId} in row ${original.rowId}`,
            );
          }
        }
      }),
    );
  });

  it("no extra fields appear in output", () => {
    // Use unique rowIds to avoid last-write-wins collisions
    const uniqueEditsArb = fc
      .uniqueArray(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 })
      .chain((rowIds) =>
        fc.tuple(...rowIds.map((rowId) => changesArb.map((changes) => ({ rowId, changes })))),
      );

    fc.assert(
      fc.property(uniqueEditsArb, (edits) => {
        const parsed = parseEditProposals({ edits });

        for (const result of parsed) {
          const original = edits.find((e) => e.rowId === result.rowId);
          assert.ok(original);
          for (const fieldId of Object.keys(result.changes)) {
            assert.ok(
              fieldId in original.changes,
              `Unexpected field ${fieldId}`,
            );
          }
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation: garbage input → empty array
// ---------------------------------------------------------------------------

describe("parseEditProposals — graceful degradation", () => {
  it("returns [] for null/undefined/non-object", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.integer(), fc.string()),
        (input) => {
          assert.deepStrictEqual(parseEditProposals(input), []);
        },
      ),
    );
  });

  it("returns [] when edits is not an array", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        (editsValue) => {
          assert.deepStrictEqual(parseEditProposals({ edits: editsValue }), []);
        },
      ),
    );
  });

  it("skips entries with missing rowId", () => {
    const result = parseEditProposals({
      edits: [{ changes: { f1: "some value" } }],
    });
    assert.equal(result.length, 0);
  });

  it("skips entries with empty changes", () => {
    const result = parseEditProposals({
      edits: [{ rowId: "r1", changes: {} }],
    });
    assert.equal(result.length, 0);
  });
});
