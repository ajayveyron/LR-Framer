import { handleCreatePost, handleListPosts } from "@/lib/post-route-handlers";
import { createErrorJsonResponse } from "@/lib/api";
import { runWithCurrentSiteFramerContext } from "@/lib/product-framer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return await runWithCurrentSiteFramerContext(request, () => handleListPosts());
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return await runWithCurrentSiteFramerContext(request, () => handleCreatePost(request));
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}
