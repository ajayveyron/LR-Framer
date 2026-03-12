import { NextResponse } from "next/server";

import { createErrorJsonResponse } from "@/lib/api";
import { logError, logEvent } from "@/lib/logger";
import {
  assertBridgeRequestAuthorized,
  extractPageIdFromPayload,
  syncApprovedNotionPages,
} from "@/lib/notion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertBridgeRequestAuthorized(request);

    const body = (await request.json().catch(() => ({}))) as unknown;
    const pageId = extractPageIdFromPayload(body);
    logEvent("info", "api.notion.webhook.started", {
      pageId,
    });
    const result = await syncApprovedNotionPages({ pageId: pageId ?? undefined });
    logEvent("info", "api.notion.webhook.succeeded", {
      backfilledFramerItemIds: result.backfilledFramerItemIds,
      mode: result.mode,
      pageId,
      publishCreatedAt: result.publish?.createdAt ?? null,
      removedPages: result.removedPages,
      syncedPages: result.syncedPages,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError("api.notion.webhook.failed", error);
    return createErrorJsonResponse(error);
  }
}
