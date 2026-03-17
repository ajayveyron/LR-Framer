import assert from "node:assert/strict";
import test from "node:test";

import type { BlogCollectionMetadata } from "@/lib/cms-types";
import { handleCreatePost, handleUpdatePost } from "@/lib/post-route-logic";

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
  ],
};

test("handleCreatePost returns created response with injected dependencies", async () => {
  const response = await handleCreatePost(
    new Request("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({
        slug: "hello-world",
        fieldValues: {
          title: "Hello world",
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }),
    {
      createBlogPost: async (input) => ({
        post: {
          id: "post-1",
          slug: input.slug,
          draft: input.draft,
          title: String(input.fieldValues.title),
          date: null,
          createdAt: null,
          lastUpdated: null,
          lastUpdatedBy: null,
          fieldValues: input.fieldValues,
        },
      }),
      getBlogMetadata: async () => metadata,
      getBlogPostById: async () => {
        throw new Error("not used");
      },
      listBlogPosts: async () => [],
      deleteBlogPost: async () => {
        throw new Error("not used");
      },
      updateBlogPost: async () => {
        throw new Error("not used");
      },
    },
  );

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.post.slug, "hello-world");
});

test("handleUpdatePost returns field errors for invalid payloads", async () => {
  const response = await handleUpdatePost(
    "post-1",
    new Request("http://localhost/api/posts/post-1", {
      method: "PUT",
      body: JSON.stringify({
        slug: "Bad Slug",
        fieldValues: {
          title: "",
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }),
    {
      createBlogPost: async () => {
        throw new Error("not used");
      },
      getBlogMetadata: async () => metadata,
      getBlogPostById: async () => {
        throw new Error("not used");
      },
      listBlogPosts: async () => [],
      deleteBlogPost: async () => {
        throw new Error("not used");
      },
      updateBlogPost: async () => {
        throw new Error("should not run");
      },
    },
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error, "Use lowercase letters, numbers, and hyphens only.");
  assert.ok(Array.isArray(payload.fieldErrors));
  assert.ok(payload.fieldErrors.some((issue: { path: string }) => issue.path === "slug"));
});
