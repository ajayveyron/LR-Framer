import "server-only";

import { logEvent } from "@/lib/logger";

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * For production scale, replace with `@upstash/ratelimit` backed by Redis.
 * This implementation is sufficient for single-instance deployments and
 * provides immediate protection against bill-runup attacks.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent unbounded growth
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs * 2;
  for (const [key, entry] of store) {
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
      store.delete(key);
    }
  }
}

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  cleanupStaleEntries(config.windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= config.limit) {
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow + config.windowMs - now;

    logEvent("warn", "rate_limit.rejected", { key, limit: config.limit, windowMs: config.windowMs });

    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs),
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    resetMs: config.windowMs,
  };
}

// ── Pre-configured limiters for AI routes ──

/** AI chat: 30 requests per minute per org */
export const AI_CHAT_LIMIT: RateLimitConfig = {
  limit: 30,
  windowMs: 60_000,
};

/** AI image generation: 10 requests per minute per org */
export const AI_IMAGE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowMs: 60_000,
};

/** AI rewrite: 20 requests per minute per org */
export const AI_REWRITE_LIMIT: RateLimitConfig = {
  limit: 20,
  windowMs: 60_000,
};
