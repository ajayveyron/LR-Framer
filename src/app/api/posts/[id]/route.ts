import { handleGetPost, handleUpdatePost, handleDeletePost } from "@/lib/post-route-handlers";
import { createErrorJsonResponse } from "@/lib/api";
import { runWithCurrentSiteFramerContext } from "@/lib/product-framer";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await runWithCurrentSiteFramerContext(() => handleGetPost(id));
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await runWithCurrentSiteFramerContext(() => handleUpdatePost(id, request));
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await runWithCurrentSiteFramerContext(() => handleDeletePost(id));
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}
