import { handleGetPost, handleUpdatePost, handleDeletePost } from "@/lib/post-route-handlers";
import { createErrorJsonResponse } from "@/lib/api";
import { runWithCurrentSiteFramerContext } from "@/lib/product-framer";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await runWithCurrentSiteFramerContext(request, () => handleGetPost(id));
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
    return await runWithCurrentSiteFramerContext(request, () => handleUpdatePost(id, request));
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await runWithCurrentSiteFramerContext(request, () => handleDeletePost(id));
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}
