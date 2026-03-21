import { NextResponse } from "next/server";

import { createErrorJsonResponse } from "@/lib/api";
import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  BlogPostSummary,
  PublishResponse,
  UpsertBlogPostInput,
} from "@/lib/cms-types";
import { logError, logEvent } from "@/lib/logger";
import { parsePostInput } from "@/lib/post-schema";

export interface PostRouteDependencies {
  createBlogPost: (
    input: UpsertBlogPostInput,
    actor: string,
  ) => Promise<{
    post: BlogPostRecord;
    publish?: PublishResponse;
  }>;
  getBlogMetadata: () => Promise<BlogCollectionMetadata>;
  getBlogPostById: (id: string) => Promise<BlogPostRecord>;
  listBlogPosts: () => Promise<BlogPostSummary[]>;
  deleteBlogPost: (id: string, actor: string) => Promise<{ postId: string; publish?: PublishResponse }>;
  updateBlogPost: (
    id: string,
    input: UpsertBlogPostInput,
    actor: string,
  ) => Promise<{
    post: BlogPostRecord;
    publish?: PublishResponse;
  }>;
}

export async function handleListPosts(
  dependencies: PostRouteDependencies,
) {
  try {
    const posts = await dependencies.listBlogPosts();
    return NextResponse.json({ posts });
  } catch (error) {
    logError("api.posts.list.failed", error);
    return createErrorJsonResponse(error);
  }
}

export async function handleCreatePost(
  request: Request,
  dependencies: PostRouteDependencies,
) {
  try {
    const metadata = await dependencies.getBlogMetadata();
    const body = parsePostInput(metadata, await request.json());
    const result = await dependencies.createBlogPost(
      { ...body, draft: true },
      "open-dashboard",
    );

    logEvent("info", "api.posts.create.succeeded", {
      actor: "open-dashboard",
      draft: true,
      postId: result.post.id,
      publishCreatedAt: result.publish?.createdAt ?? null,
      slug: result.post.slug,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logError("api.posts.create.failed", error);
    return createErrorJsonResponse(error);
  }
}

export async function handleGetPost(
  id: string,
  dependencies: PostRouteDependencies,
) {
  try {
    const post = await dependencies.getBlogPostById(id);
    return NextResponse.json({ post });
  } catch (error) {
    logError("api.posts.get.failed", error, { postId: id });
    return createErrorJsonResponse(error);
  }
}

export async function handleUpdatePost(
  id: string,
  request: Request,
  dependencies: PostRouteDependencies,
) {
  try {
    const metadata = await dependencies.getBlogMetadata();
    const body = parsePostInput(metadata, await request.json());
    const isDraft = body.draft === true;
    const result = await dependencies.updateBlogPost(
      id,
      { ...body, draft: isDraft, publish: !isDraft },
      "open-dashboard",
    );

    logEvent("info", "api.posts.update.succeeded", {
      actor: "open-dashboard",
      draft: isDraft,
      postId: result.post.id,
      publishCreatedAt: result.publish?.createdAt ?? null,
      slug: result.post.slug,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError("api.posts.update.failed", error, { postId: id });
    return createErrorJsonResponse(error);
  }
}

export async function handleDeletePost(
  id: string,
  dependencies: PostRouteDependencies,
) {
  try {
    const result = await dependencies.deleteBlogPost(id, "open-dashboard");

    logEvent("info", "api.posts.delete.succeeded", {
      actor: "open-dashboard",
      postId: id,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError("api.posts.delete.failed", error, { postId: id });
    return createErrorJsonResponse(error);
  }
}
