import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { anyApi } from "convex/server";

import { createErrorJsonResponse } from "@/lib/api";
import { fetchProductMutation, fetchProductQuery } from "@/lib/convex";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

/** List all memories for the current user */
export async function GET() {
  try {
    const { orgId, userId } = await auth();
    if (!userId || !orgId) {
      throw new AppError("Unauthorized", 401);
    }

    const memories = await fetchProductQuery(anyApi.agentMemory.listMemories, {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
    });

    return NextResponse.json({ memories });
  } catch (error) {
    logError("ai.memory.list.failed", error);
    return createErrorJsonResponse(error);
  }
}

/** Save a new memory */
export async function POST(request: Request) {
  try {
    const { orgId, userId } = await auth();
    if (!userId || !orgId) {
      throw new AppError("Unauthorized", 401);
    }

    const body = (await request.json()) as {
      category?: string;
      content?: string;
    };

    if (!body.category || !body.content) {
      throw new AppError("Missing required fields: category, content", 400);
    }

    const validCategories = ["preference", "correction", "workflow"];
    if (!validCategories.includes(body.category)) {
      throw new AppError(
        `Invalid category. Must be one of: ${validCategories.join(", ")}`,
        400,
      );
    }

    await fetchProductMutation(anyApi.agentMemory.saveMemory, {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      category: body.category as "preference" | "correction" | "workflow",
      content: body.content,
    });

    logEvent("info", "ai.memory.saved", {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      category: body.category,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("ai.memory.save.failed", error);
    return createErrorJsonResponse(error);
  }
}
