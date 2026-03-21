import assert from "node:assert/strict";
import test from "node:test";

import type { BlogCollectionMetadata } from "@/lib/cms-types";
import { parsePostInput } from "@/lib/post-schema";

const metadata: BlogCollectionMetadata = {
  collectionId: "blog",
  collectionName: "Blog",
  logicalFields: {
    title: "title",
  },
  fields: [
    {
      id: "title",
      name: "Title",
      type: "string",
      required: true,
      supported: true,
      logicalKey: "title",
    },
    {
      id: "publishDate",
      name: "Publish Date",
      type: "date",
      required: false,
      supported: true,
    },
    {
      id: "category",
      name: "Category",
      type: "enum",
      required: true,
      supported: true,
      options: [
        {
          label: "News",
          value: "News",
        },
      ],
    },
  ],
};

test("parsePostInput accepts valid metadata-aware payloads", () => {
  const result = parsePostInput(metadata, {
    slug: "hello-world",
    fieldValues: {
      title: "Hello world",
      publishDate: "2026-03-12",
      category: "News",
    },
  });

  assert.equal(result.slug, "hello-world");
  assert.equal(result.fieldValues.title, "Hello world");
});

test("parsePostInput rejects invalid enum values", () => {
  assert.throws(
    () =>
      parsePostInput(metadata, {
        slug: "hello-world",
        fieldValues: {
          title: "Hello world",
          category: "Unknown",
        },
      }),
    /available option/,
  );
});

test("parsePostInput passes through unknown field IDs without error", () => {
  const result = parsePostInput(metadata, {
    slug: "hello-world",
    fieldValues: {
      title: "Hello world",
      category: "News",
      unknownFieldId: "some value",
    },
  });

  assert.equal(result.slug, "hello-world");
  assert.equal((result.fieldValues as Record<string, unknown>).unknownFieldId, "some value");
});
