import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { anyApi } from "convex/server";

import { createErrorJsonResponse } from "@/lib/api";
import { fetchProductMutation, fetchProductQuery } from "@/lib/convex";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";

export const runtime = "nodejs";

/** List conversations for the current user */
export async function GET() {
  try {
    const { orgId, userId } = await auth();
    if (!userId || !orgId) {
      throw new AppError("Unauthorized", 401);
    }

    const rows = await fetchProductQuery(anyApi.chat.listConversations, {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
    });

    return NextResponse.json({ conversations: rows });
  } catch (error) {
    logError("ai.chat.history.list.failed", error);
    return createErrorJsonResponse(error);
  }
}

/** Save / upsert a conversation */
export async function POST(request: Request) {
  try {
    const { orgId, userId } = await auth();
    if (!userId || !orgId) {
      throw new AppError("Unauthorized", 401);
    }

    const body = (await request.json()) as {
      conversationId?: string;
      messages?: string;
      title?: string;
    };

    if (!body.conversationId || !body.messages || !body.title) {
      throw new AppError("Missing required fields", 400);
    }

    await fetchProductMutation(anyApi.chat.saveConversation, {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      conversationId: body.conversationId,
      messages: body.messages,
      title: body.title,
    });

    logEvent("info", "ai.chat.history.saved", {
      clerkOrganizationId: orgId,
      clerkUserId: userId,
      conversationId: body.conversationId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("ai.chat.history.save.failed", error);
    return createErrorJsonResponse(error);
  }
}
