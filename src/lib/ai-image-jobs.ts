/**
 * In-memory store for background image generation jobs.
 *
 * Jobs are created when the AI agent requests an image, and the actual
 * generation + upload runs asynchronously so the agent can continue working.
 * The frontend polls for completion and renders the result.
 *
 * This is intentionally in-memory — jobs are ephemeral and scoped to the
 * current server process. A server restart clears pending jobs, which is
 * fine because the chat session would also be interrupted.
 *
 * IMPORTANT: We attach the Map to globalThis so it survives module
 * re-evaluations in Next.js dev mode (HMR / Turbopack) and is shared
 * across all route handlers within the same Node.js process.
 */

import { logEvent } from "@/lib/logger";

export interface ImageJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  prompt: string;
  /** Framer asset URL once upload completes */
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  appliedTargetCount?: number;
  pendingTargets?: Array<{
    stagedItemId: string;
    fieldId: string;
  }>;
}

const GLOBAL_KEY = "__framerlink_image_jobs" as const;

// Attach to globalThis so the store is shared across all route handlers
// and survives HMR re-evaluations in dev mode.
const jobs: Map<string, ImageJob> =
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] as Map<string, ImageJob> ??
  (() => {
    const map = new Map<string, ImageJob>();
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = map;
    return map;
  })();

// Clean up old jobs every 10 minutes (keep last 30 min).
// Guard against duplicate intervals from HMR re-evaluations.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_JOB_AGE_MS = 30 * 60 * 1000;
const CLEANUP_KEY = "__framerlink_image_jobs_cleanup" as const;

if (!(globalThis as Record<string, unknown>)[CLEANUP_KEY]) {
  (globalThis as Record<string, unknown>)[CLEANUP_KEY] = true;
  setInterval(() => {
    const cutoff = Date.now() - MAX_JOB_AGE_MS;
    for (const [id, job] of jobs) {
      if (job.createdAt < cutoff) jobs.delete(id);
    }
  }, CLEANUP_INTERVAL_MS);
}

export function createImageJob(id: string, prompt: string): ImageJob {
  const job: ImageJob = { id, status: "pending", prompt, createdAt: Date.now() };
  jobs.set(id, job);
  logEvent("info", "ai.image_job.created", { jobId: id, prompt });
  return job;
}

export function getImageJob(id: string): ImageJob | undefined {
  return jobs.get(id);
}

export function updateImageJob(id: string, update: Partial<ImageJob>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, update);
  if (update.status === "completed" || update.status === "failed") {
    job.completedAt = Date.now();
    const durationMs = job.completedAt - job.createdAt;
    if (update.status === "completed") {
      logEvent("info", "ai.image_job.completed", { jobId: id, durationMs, url: job.url });
    } else {
      logEvent("warn", "ai.image_job.failed", { jobId: id, durationMs, error: job.error });
    }
  }
}

export function addImageJobTarget(
  id: string,
  target: { stagedItemId: string; fieldId: string },
): ImageJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;

  const pendingTargets = job.pendingTargets ?? [];
  const exists = pendingTargets.some(
    (entry) =>
      entry.stagedItemId === target.stagedItemId &&
      entry.fieldId === target.fieldId,
  );

  if (!exists) {
    pendingTargets.push(target);
    job.pendingTargets = pendingTargets;
  }

  return job;
}

export function removeImageJobTarget(
  id: string,
  target: { stagedItemId: string; fieldId: string },
): ImageJob | undefined {
  const job = jobs.get(id);
  if (!job?.pendingTargets?.length) return job;

  job.pendingTargets = job.pendingTargets.filter(
    (entry) =>
      !(
        entry.stagedItemId === target.stagedItemId &&
        entry.fieldId === target.fieldId
      ),
  );

  return job;
}

export function incrementImageJobAppliedTargetCount(id: string): ImageJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  job.appliedTargetCount = (job.appliedTargetCount ?? 0) + 1;
  return job;
}
