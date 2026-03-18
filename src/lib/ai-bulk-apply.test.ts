import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { applyBulkEdits } from "./ai-bulk-apply.js";
import type { ProposedEdit } from "./ai-edit-parser.js";
import type { BlogPostRecord } from "./cms-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakePost(id: string): BlogPostRecord {
  return {
    id,
    slug: `slug-${id}`,
    draft: false,
    title: `Title ${id}`,
    date: null,
    createdAt: null,
    lastUpdated: null,
    lastUpdatedBy: null,
    fieldValues: { title: `Title ${id}` },
  };
}

function makeFakeEdit(rowId: string): ProposedEdit {
  return {
    rowId,
    changes: {
      title: {
        fieldName: "Title",
        currentValue: `Title ${rowId}`,
        proposedValue: `Updated ${rowId}`,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Property 10: Partial failure resilience in bulk apply
// When some fetches fail and some succeed, the result correctly partitions
// them into succeeded/failed arrays, and total always equals input count.
// ---------------------------------------------------------------------------

describe("Property 10 — partial failure resilience", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("succeeded + failed always equals total edits", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 1,
          maxLength: 8,
        }),
        fc.func(fc.boolean()),
        async (rowIds, shouldSucceedFn) => {
          const posts = rowIds.map(makeFakePost);
          const edits = rowIds.map(makeFakeEdit);

          // Decide per-row whether the fetch succeeds or fails
          const successMap = new Map<string, boolean>();
          rowIds.forEach((id) => successMap.set(id, shouldSucceedFn(id)));

          globalThis.fetch = (async (input: string | URL | Request) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            const id = url.split("/").pop()!;
            if (successMap.get(id)) {
              return new Response(JSON.stringify({ ok: true }), { status: 200 });
            }
            return new Response(JSON.stringify({ error: "fail" }), { status: 500 });
          }) as typeof fetch;

          const result = await applyBulkEdits(edits, posts);
          assert.equal(
            result.succeeded.length + result.failed.length,
            edits.length,
            "succeeded + failed must equal total",
          );
        },
      ),
    );
  });

  it("edits for missing posts always land in failed", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 1,
          maxLength: 5,
        }),
        async (rowIds) => {
          const edits = rowIds.map(makeFakeEdit);
          // Pass empty posts array — all should fail
          globalThis.fetch = originalFetch;

          const result = await applyBulkEdits(edits, []);
          assert.equal(result.failed.length, edits.length);
          assert.equal(result.succeeded.length, 0);
          for (const f of result.failed) {
            assert.ok(f.error.includes("not found"));
          }
        },
      ),
    );
  });

  it("all-success scenario puts every row in succeeded", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 1,
          maxLength: 8,
        }),
        async (rowIds) => {
          const posts = rowIds.map(makeFakePost);
          const edits = rowIds.map(makeFakeEdit);

          globalThis.fetch = (async () =>
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
            })) as typeof fetch;

          const result = await applyBulkEdits(edits, posts);
          assert.equal(result.succeeded.length, edits.length);
          assert.equal(result.failed.length, 0);
        },
      ),
    );
  });
});
