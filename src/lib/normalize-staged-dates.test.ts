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

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("normalizeStagedDates", () => {
  it("keeps full ISO string as-is for date-only fields", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates(
      { d1: "2025-03-15T10:30:00.000Z" },
      metadata,
    );
    // Date-only: should normalize to midnight UTC in Framer ISO format
    assert.match(result.d1 as string, ISO_REGEX);
    assert.equal(result.d1, "2025-03-15T00:00:00.000Z");
  });

  it("normalizes full ISO string to Framer ISO format for date+time fields", () => {
    const metadata = makeMetadata([
      { id: "d1", type: "date", displayTime: true },
    ]);
    const result = normalizeStagedDates(
      { d1: "2025-03-15T10:30:00.000Z" },
      metadata,
    );
    assert.match(result.d1 as string, ISO_REGEX);
    assert.equal(result.d1, "2025-03-15T10:30:00.000Z");
  });

  it("normalizes short date-only values to Framer ISO format", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates({ d1: "2025-03-15" }, metadata);
    assert.match(result.d1 as string, ISO_REGEX);
    assert.equal(result.d1, "2025-03-15T00:00:00.000Z");
  });

  it("normalizes short date+time values to Framer ISO format", () => {
    const metadata = makeMetadata([
      { id: "d1", type: "date", displayTime: true },
    ]);
    const result = normalizeStagedDates({ d1: "2025-03-15T10:30" }, metadata);
    assert.match(result.d1 as string, ISO_REGEX);
  });

  it("leaves already-valid Framer ISO values unchanged", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates(
      { d1: "2025-03-15T00:00:00.000Z" },
      metadata,
    );
    assert.equal(result.d1, "2025-03-15T00:00:00.000Z");
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

  it("normalizes natural language date strings to Framer ISO format", () => {
    const metadata = makeMetadata([{ id: "d1", type: "date" }]);
    const result = normalizeStagedDates(
      { d1: "March 15, 2025" },
      metadata,
    );
    assert.match(result.d1 as string, ISO_REGEX);
  });
});
