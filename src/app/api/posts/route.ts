import { handleCreatePost, handleListPosts } from "@/lib/post-route-handlers";

export const runtime = "nodejs";

export async function GET() {
  return handleListPosts();
}

export async function POST(request: Request) {
  return handleCreatePost(request);
}
