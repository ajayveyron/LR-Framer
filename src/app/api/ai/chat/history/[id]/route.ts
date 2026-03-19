import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { anyApi } from "convex/server";

import { createErrorJsonResponse } from "@/lib/api";
import { fetchProductMutation } from "@/lib/convex";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId, userId } = await auth();
    if (!userId || !orgId) {
      throw new AppError("Unauthorized", 401);
    }

    const { id: conversationId } = await params;

    await fetchProductMutation(anyApi.chat.deleteConversation, {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      conversationId,
    });

    logEvent("info", "ai.chat.history.deleted", {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      conversationId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("ai.chat.history.delete.failed", error);
    return createErrorJsonResponse(error);
  }
}
