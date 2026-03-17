import { handleCreatePost, handleListPosts } from "@/lib/post-route-handlers";
import { createErrorJsonResponse } from "@/lib/api";
import { runWithCurrentSiteFramerContext } from "@/lib/product-framer";

export const runtime = "nodejs";

export async function GET() {
  try {
    return await runWithCurrentSiteFramerContext(() => handleListPosts());
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return await runWithCurrentSiteFramerContext(() => handleCreatePost(request));
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}
