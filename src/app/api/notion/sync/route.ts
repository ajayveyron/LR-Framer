import { NextResponse } from "next/server";
import { z } from "zod";

import { createErrorJsonResponse } from "@/lib/api";
import { logError, logEvent } from "@/lib/logger";
import { assertBridgeRequestAuthorized, syncApprovedNotionPages } from "@/lib/notion";

export const runtime = "nodejs";

const syncSchema = z
  .object({
    pageId: z.string().min(1).optional(),
  })
  .optional();

export async function POST(request: Request) {
  try {
    assertBridgeRequestAuthorized(request);

    const body = syncSchema.parse(await request.json().catch(() => undefined));
    logEvent("info", "api.notion.sync.started", {
      mode: body?.pageId ? "page" : "allApproved",
      pageId: body?.pageId ?? null,
    });
    const result = await syncApprovedNotionPages({ pageId: body?.pageId });
    logEvent("info", "api.notion.sync.succeeded", {
      backfilledFramerItemIds: result.backfilledFramerItemIds,
      mode: result.mode,
      publishCreatedAt: result.publish?.createdAt ?? null,
      removedPages: result.removedPages,
      syncedPages: result.syncedPages,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError("api.notion.sync.failed", error);
    return createErrorJsonResponse(error);
  }
}
