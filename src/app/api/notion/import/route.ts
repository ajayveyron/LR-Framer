import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorResponse } from "@/lib/api";
import {
  assertBridgeRequestAuthorized,
  importFramerPostsToNotion,
} from "@/lib/notion";

export const runtime = "nodejs";

const importSchema = z
  .object({
    postId: z.string().min(1).optional(),
  })
  .optional();

export async function POST(request: Request) {
  try {
    assertBridgeRequestAuthorized(request);

    const body = importSchema.parse(await request.json().catch(() => undefined));
    const result = await importFramerPostsToNotion({ postId: body?.postId });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[notion-import]", error);
    const mapped = getErrorResponse(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
