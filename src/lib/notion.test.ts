import assert from "node:assert/strict";
import test from "node:test";

import { extractPageIdFromPayload } from "@/lib/notion-payload";

test("extractPageIdFromPayload reads multiple webhook payload shapes", () => {
  assert.equal(extractPageIdFromPayload({ pageId: "page-1" }), "page-1");
  assert.equal(extractPageIdFromPayload({ page: { id: "page-2" } }), "page-2");
  assert.equal(extractPageIdFromPayload({ data: { id: "page-3" } }), "page-3");
  assert.equal(extractPageIdFromPayload({ entity: { id: "page-4" } }), "page-4");
  assert.equal(extractPageIdFromPayload({ nope: true }), null);
});
