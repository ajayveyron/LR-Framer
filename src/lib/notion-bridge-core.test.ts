import assert from "node:assert/strict";
import test from "node:test";

import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  BridgeSyncInput,
  BridgeSyncResponse,
} from "@/lib/cms-types";
import { AppError } from "@/lib/errors";
import {
  buildBridgeSyncInput,
  buildSourceVersion,
  syncNotionPageToFramer,
  type NotionBridgeConfig,
  type NotionPage,
  type NotionProperty,
} from "@/lib/notion-bridge-core";

const bridgeConfig: NotionBridgeConfig = {
  approvedStatusValue: "Approved",
  fieldMap: {
    seoSummary: "Excerpt",
  },
  framerItemIdPropertyName: "Framer Item ID",
  slugPropertyName: "Slug",
  statusPropertyName: "Status",
};

const metadata: BlogCollectionMetadata = {
  collectionId: "blog",
  collectionName: "Blog",
  logicalFields: {
    body: "body",
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
      id: "body",
      name: "Body",
      type: "formattedText",
      required: false,
      supported: true,
      logicalKey: "body",
    },
    {
      id: "description",
      name: "Description",
      type: "string",
      required: false,
      supported: true,
    },
    {
      id: "views",
      name: "Views",
      type: "number",
      required: false,
      supported: true,
    },
    {
      id: "rating",
      name: "Rating",
      type: "number",
      required: false,
      supported: true,
    },
    {
      id: "published",
      name: "Published",
      type: "boolean",
      required: false,
      supported: true,
    },
    {
      id: "publishDate",
      name: "Publish Date",
      type: "date",
      required: false,
      supported: true,
    },
    {
      id: "scheduledAt",
      name: "Scheduled At",
      type: "date",
      required: false,
      supported: true,
      displayTime: true,
    },
    {
      id: "category",
      name: "Category",
      type: "enum",
      required: false,
      supported: true,
    },
    {
      id: "tags",
      name: "Tags",
      type: "multiCollectionReference",
      required: false,
      supported: true,
    },
    {
      id: "heroImage",
      name: "Hero Image",
      type: "image",
      required: false,
      supported: true,
    },
    {
      id: "ctaUrl",
      name: "CTA URL",
      type: "link",
      required: false,
      supported: true,
    },
    {
      id: "author",
      name: "Author",
      type: "string",
      required: false,
      supported: true,
      logicalKey: "author",
    },
    {
      id: "seoSummary",
      name: "SEO Summary",
      type: "string",
      required: false,
      supported: true,
    },
  ],
};

function richTextProperty(content: string): NotionProperty {
  return {
    id: `rt:${content}`,
    type: "rich_text",
    rich_text: content
      ? [
          {
            plain_text: content,
          },
        ]
      : [],
  };
}

function titleProperty(content: string): NotionProperty {
  return {
    id: `title:${content}`,
    type: "title",
    title: content
      ? [
          {
            plain_text: content,
          },
        ]
      : [],
  };
}

function statusProperty(name: string): NotionProperty {
  return {
    id: `status:${name}`,
    type: "status",
    status: name ? { name } : null,
  };
}

function selectProperty(name: string): NotionProperty {
  return {
    id: `select:${name}`,
    type: "select",
    select: name ? { name } : null,
  };
}

function dateProperty(start: string | null): NotionProperty {
  return {
    id: `date:${start ?? "null"}`,
    type: "date",
    date: start ? { start } : null,
  };
}

function multiSelectProperty(...names: string[]): NotionProperty {
  return {
    id: `multi:${names.join(",")}`,
    type: "multi_select",
    multi_select: names.map((name) => ({ name })),
  };
}

function filesProperty(url: string): NotionProperty {
  return {
    id: `files:${url}`,
    type: "files",
    files: [
      {
        type: "external",
        name: "hero.png",
        external: {
          url,
        },
      },
    ],
  };
}

function urlProperty(url: string): NotionProperty {
  return {
    id: `url:${url}`,
    type: "url",
    url,
  };
}

function pageWithProperties(
  properties: Record<string, NotionProperty>,
  overrides?: Partial<NotionPage>,
): NotionPage {
  return {
    object: "page",
    id: "page-1",
    properties,
    ...overrides,
  };
}

function makeBridgeResponse(
  input: BridgeSyncInput,
  overrides?: Partial<BridgeSyncResponse>,
): BridgeSyncResponse {
  const post: BlogPostRecord = {
    id: "framer-1",
    slug: input.slug,
    draft: input.draft,
    title: String(input.fieldValues.title),
    date: null,
    createdAt: null,
    lastUpdated: null,
    lastUpdatedBy: null,
    fieldValues: input.fieldValues,
  };

  return {
    results: [
      {
        externalId: input.externalId,
        framerItemId: post.id,
        action: "updated",
        matchedBy: "slug",
        post,
      },
    ],
    ...overrides,
  };
}

function makeDeletedResponse(externalId: string): BridgeSyncResponse {
  const post: BlogPostRecord = {
    id: "framer-1",
    slug: "old-post",
    draft: true,
    title: "Old post",
    date: null,
    createdAt: null,
    lastUpdated: null,
    lastUpdatedBy: null,
    fieldValues: {},
  };

  return {
    results: [
      {
        externalId,
        framerItemId: post.id,
        action: "deleted",
        matchedBy: "framerItemId",
        post,
      },
    ],
  };
}

function buildApprovedPage(overrides?: Partial<Record<string, NotionProperty>>): NotionPage {
  return pageWithProperties({
    Name: titleProperty("Hello World"),
    Status: statusProperty("Approved"),
    Slug: richTextProperty("This is My Slug!!"),
    "Framer Item ID": richTextProperty(""),
    Description: richTextProperty(""),
    Views: richTextProperty("42"),
    Rating: richTextProperty("not-a-number"),
    Published: richTextProperty("TRUE"),
    "Publish Date": dateProperty("2026-03-10T05:00:00.000Z"),
    "Scheduled At": dateProperty("2026-03-10T05:00:00.000Z"),
    Category: multiSelectProperty("Guides", "Release Notes"),
    Tags: multiSelectProperty("nextjs", "notion"),
    "Hero Image": filesProperty("https://cdn.example.com/hero.png"),
    "CTA URL": urlProperty("https://example.com/go"),
    Author: selectProperty("Ajay"),
    Excerpt: richTextProperty("SEO blurb"),
    ...(overrides ?? {}),
  });
}

test("buildBridgeSyncInput maps Notion fields into Framer values and sanitizes slug", () => {
  const input = buildBridgeSyncInput(
    metadata,
    buildApprovedPage(),
    "## Body from markdown",
    bridgeConfig,
  );

  assert.equal(input.externalId, "page-1");
  assert.equal(input.framerItemId, null);
  assert.equal(input.slug, "this-is-my-slug");
  assert.equal(input.draft, false);
  assert.equal(typeof input.sourceVersion, "string");
  assert.equal(input.sourceVersion?.length, 64);
  assert.deepEqual(input.fieldValues, {
    title: "Hello World",
    body: "## Body from markdown",
    description: "Hello World",
    views: 42,
    rating: null,
    published: true,
    publishDate: "2026-03-10",
    scheduledAt: "2026-03-10T05:00:00.000Z",
    category: "Guides",
    tags: ["nextjs", "notion"],
    heroImage: "https://cdn.example.com/hero.png",
    ctaUrl: "https://example.com/go",
    author: "Ajay",
    seoSummary: "SEO blurb",
  });
});

test("buildBridgeSyncInput falls back to the title when the slug is blank", () => {
  const input = buildBridgeSyncInput(
    metadata,
    buildApprovedPage({
      Slug: richTextProperty("   "),
    }),
    "",
    bridgeConfig,
  );

  assert.equal(input.slug, "hello-world");
});

test("buildSourceVersion ignores Framer item id backfills", () => {
  const firstPage = buildApprovedPage({
    "Framer Item ID": richTextProperty("framer-1"),
  });
  const secondPage = buildApprovedPage({
    "Framer Item ID": richTextProperty("framer-2"),
  });

  assert.equal(
    buildSourceVersion(firstPage, "## Body from markdown", bridgeConfig),
    buildSourceVersion(secondPage, "## Body from markdown", bridgeConfig),
  );
});

test("syncNotionPageToFramer syncs approved pages and backfills new Framer ids", async () => {
  const page = buildApprovedPage();
  const captured: BridgeSyncInput[] = [];
  const backfills: Array<{ pageId: string; framerItemId: string }> = [];

  const result = await syncNotionPageToFramer(
    metadata,
    page,
    "## Body from markdown",
    bridgeConfig,
    {
      backfillFramerItemId: async (sourcePage, framerItemId) => {
        backfills.push({ pageId: sourcePage.id, framerItemId });
        return true;
      },
      removeBridgePosts: async () => {
        throw new Error("removeBridgePosts should not run");
      },
      syncBridgePosts: async (inputs, actor, publishRequested) => {
        captured.push(...inputs);
        assert.equal(actor, "notion-bridge");
        assert.equal(publishRequested, true);
        return makeBridgeResponse(inputs[0], {
          publish: {
            createdAt: "2026-03-16T10:00:00.000Z",
            deploymentId: "deploy-1",
            hostnames: ["blog.example.com"],
          },
        });
      },
    },
  );

  assert.equal(captured.length, 1);
  assert.equal(captured[0].draft, false);
  assert.equal(result.mode, "page");
  assert.equal(result.syncedPages, 1);
  assert.equal(result.removedPages, 0);
  assert.equal(result.backfilledFramerItemIds, 1);
  assert.deepEqual(backfills, [{ pageId: "page-1", framerItemId: "framer-1" }]);
  assert.equal(result.publish?.deploymentId, "deploy-1");
});

test("syncNotionPageToFramer keeps unapproved pages as drafts", async () => {
  const page = buildApprovedPage({
    Status: statusProperty("In Review"),
  });
  let capturedDraft: boolean | null = null;

  const result = await syncNotionPageToFramer(
    metadata,
    page,
    "Draft markdown",
    bridgeConfig,
    {
      removeBridgePosts: async () => {
        throw new Error("removeBridgePosts should not run");
      },
      syncBridgePosts: async (inputs) => {
        capturedDraft = inputs[0].draft;
        return makeBridgeResponse(inputs[0]);
      },
    },
  );

  assert.equal(capturedDraft, true);
  assert.equal(result.syncedPages, 1);
  assert.equal(result.backfilledFramerItemIds, 0);
});

test("syncNotionPageToFramer removes archived pages instead of syncing them", async () => {
  const page = pageWithProperties(
    {
      Status: statusProperty("Approved"),
      Slug: richTextProperty("archived-post"),
      "Framer Item ID": richTextProperty("framer-1"),
    },
    {
      archived: true,
      id: "page-archived",
    },
  );
  let removedExternalId: string | null = null;

  const result = await syncNotionPageToFramer(
    metadata,
    page,
    "",
    bridgeConfig,
    {
      removeBridgePosts: async (inputs) => {
        removedExternalId = inputs[0].externalId;
        assert.equal(inputs[0].slug, "archived-post");
        assert.equal(inputs[0].framerItemId, "framer-1");
        return makeDeletedResponse(inputs[0].externalId);
      },
      syncBridgePosts: async () => {
        throw new Error("syncBridgePosts should not run");
      },
    },
  );

  assert.equal(removedExternalId, "page-archived");
  assert.equal(result.syncedPages, 0);
  assert.equal(result.removedPages, 1);
  assert.equal(result.results[0]?.action, "deleted");
});

test("buildBridgeSyncInput rejects pages with an empty title", () => {
  assert.throws(
    () =>
      buildBridgeSyncInput(
        metadata,
        buildApprovedPage({
          Name: titleProperty(""),
        }),
        "",
        bridgeConfig,
      ),
    (error: unknown) =>
      error instanceof AppError && error.message === "The Notion page title is empty.",
  );
});

test("buildBridgeSyncInput rejects pages without a title property", () => {
  const page = buildApprovedPage();
  delete page.properties.Name;

  assert.throws(
    () => buildBridgeSyncInput(metadata, page, "", bridgeConfig),
    (error: unknown) =>
      error instanceof AppError &&
      error.message === "The Notion page does not expose a title property.",
  );
});
