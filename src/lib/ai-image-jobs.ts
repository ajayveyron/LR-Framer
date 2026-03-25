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
 */

import { logEvent, logError } from "@/lib/logger";

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
}

const jobs = new Map<string, ImageJob>();

// Clean up old jobs every 10 minutes (keep last 30 min)
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_JOB_AGE_MS = 30 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - MAX_JOB_AGE_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, CLEANUP_INTERVAL_MS);

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
