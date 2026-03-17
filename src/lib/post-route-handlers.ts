import {
  createBlogPost,
  getBlogMetadata,
  getBlogPostById,
  deleteBlogPost,
  listBlogPosts,
  updateBlogPost,
} from "@/lib/framer";
import {
  handleCreatePost as handleCreatePostWithDeps,
  handleGetPost as handleGetPostWithDeps,
  handleDeletePost as handleDeletePostWithDeps,
  handleListPosts as handleListPostsWithDeps,
  handleUpdatePost as handleUpdatePostWithDeps,
} from "@/lib/post-route-logic";

const dependencies = {
  createBlogPost,
  getBlogMetadata,
  getBlogPostById,
  deleteBlogPost,
  listBlogPosts,
  updateBlogPost,
};

export function handleListPosts() {
  return handleListPostsWithDeps(dependencies);
}

export function handleCreatePost(request: Request) {
  return handleCreatePostWithDeps(request, dependencies);
}

export function handleGetPost(id: string) {
  return handleGetPostWithDeps(id, dependencies);
}

export function handleUpdatePost(id: string, request: Request) {
  return handleUpdatePostWithDeps(id, request, dependencies);
}

export function handleDeletePost(id: string) {
  return handleDeletePostWithDeps(id, dependencies);
}
