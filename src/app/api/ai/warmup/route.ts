import { NextResponse } from "next/server";

import { getAIContextSnapshotWithRunner } from "@/lib/ai-context-snapshot";
import { loadAgentMemories } from "@/lib/ai-memory";
import { checkQuota } from "@/lib/billing";
import { logEvent, logError } from "@/lib/logger";
import {
  getSiteFramerRuntimeContext,
  requireDashboardApiAccess,
} from "@/lib/product-access";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";

export const runtime = "nodejs";

/**
 * Lightweight warmup endpoint — pre-populates the server-side caches
 * (context snapshot, agent memories, quota) so the first real chat
 * request hits warm caches and responds faster.
 *
 * Fire-and-forget from the client when the chat panel opens.
 */
export async function POST(request: Request) {
  const startMs = Date.now();

  try {
    const access = await requireDashboardApiAccess();
    const { organizationId: orgId, userId } = access;

    const body = await request.json().catch(() => ({}));
    const activeCollectionId =
      typeof body.activeCollectionId === "string"
        ? body.activeCollectionId
        : undefined;
    const activeCollectionName =
      typeof body.activeCollectionName === "string"
        ? body.activeCollectionName
        : undefined;

    const activeCollection =
      activeCollectionId && activeCollectionName
        ? { id: activeCollectionId, name: activeCollectionName }
        : undefined;

    const baseContext = getSiteFramerRuntimeContext(
      access.site,
      activeCollection
        ? {
            collectionId: activeCollection.id,
            collectionName: activeCollection.name,
          }
        : undefined,
    );
    const runInFramerContext = <T,>(fn: () => Promise<T>) =>
      runWithFramerRuntimeContext(baseContext, fn);

    const cacheKey = access.site.framerProjectId
      ? `framer-project:${access.site.framerProjectId}:focus:${activeCollection?.id ?? "none"}`
      : `org:${access.organizationId}:focus:${activeCollection?.id ?? "none"}`;

    // Warm all three caches concurrently — same as the chat route's prefetch
    await Promise.all([
      orgId
        ? checkQuota(orgId).catch((err) => {
            logError("ai.warmup.quota_failed", err, { organizationId: orgId });
          })
        : Promise.resolve(null),
      loadAgentMemories(orgId, userId).catch((err) => {
        logError("ai.warmup.memories_failed", err);
      }),
      getAIContextSnapshotWithRunner(runInFramerContext, {
        cacheKey,
        focusCollectionId: activeCollection?.id,
      }).catch((err) => {
        logError("ai.warmup.snapshot_failed", err);
      }),
    ]);

    logEvent("info", "ai.warmup.completed", {
      durationMs: Date.now() - startMs,
      organizationId: orgId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("ai.warmup.failed", error);
    // Non-critical — return 200 anyway so the client doesn't retry
    return NextResponse.json({ ok: false });
  }
}
