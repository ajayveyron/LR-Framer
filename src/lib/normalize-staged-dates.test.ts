import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeStagedDates } from "./normalize-staged-dates";
import type { BlogCollectionMetadata } from "./cms-types";

function makeMetadata(
  fields: Array<{ id: string; type: string; displayTime?: boolean }>,
): BlogCollectionMetadata {
  return {
    collectionId: "test-col",
    collectionName: "Test",
    logicalFields: {},
    fields: fields.map((f) => ({
      id: f.id,
      name: f.id,
      type: f.type,
      supported: true,
      required: false,
      displayTime: f.displayTime,
    })) as BlogCollectionMetadata["fields"],
  };
}

describe("normalizeStagedDates", () => {
  it("normalizes full ISO string to YYYY-MM-DD for date-only fields", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates(
      { d1: "2025-03-15T10:30:00.000Z" },
      metadata,
    );
    // Date-only: should strip time portion
    assert.match(result.d1 as string, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalizes full ISO string to YYYY-MM-DDTHH:mm for date+time fields", () => {
    const metadata = makeMetadata([
      { id: "d1", type: "date", displayTime: true },
    ]);
    const result = normalizeStagedDates(
      { d1: "2025-03-15T10:30:00.000Z" },
      metadata,
    );
    assert.match(result.d1 as string, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("leaves already-valid date-only values unchanged", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates({ d1: "2025-03-15" }, metadata);
    assert.equal(result.d1, "2025-03-15");
  });

  it("leaves already-valid date+time values unchanged", () => {
    const metadata = makeMetadata([
      { id: "d1", type: "date", displayTime: true },
    ]);
    const result = normalizeStagedDates({ d1: "2025-03-15T10:30" }, metadata);
    assert.equal(result.d1, "2025-03-15T10:30");
  });

  it("does not touch non-date fields", () => {
    const metadata = makeMetadata([
      { id: "title", type: "string" },
      { id: "d1", type: "date" },
    ]);
    const result = normalizeStagedDates(
      { title: "Hello", d1: "2025-03-15T10:30:00.000Z" },
      metadata,
    );
    assert.equal(result.title, "Hello");
  });

  it("handles null/undefined date values gracefully", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates({ d1: null as any }, metadata);
    assert.equal(result.d1, null);
  });

  it("handles invalid date strings gracefully", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates({ d1: "not-a-date" }, metadata);
    assert.equal(result.d1, "not-a-date");
  });

  it("handles epoch-style date strings", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates(
      { d1: "March 15, 2025" },
      metadata,
    );
    assert.match(result.d1 as string, /^\d{4}-\d{2}-\d{2}$/);
  });
});
