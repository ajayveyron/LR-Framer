"use client";

import { useCallback, useEffect, useState } from "react";

export interface BillingUsageData {
  percentUsed: number;
  currentUsage: number;
  allowance: number;
  planName: string;
  byFeature: { chat: number; image: number; image_tool: number; rewrite: number };
  byUser: Array<{ userId: string; totalTokens: number }>;
  cycleStart: string;
  cycleEnd: string;
}

type MeterState = "normal" | "warning" | "exhausted";

export function deriveMeterState(percent: number): MeterState {
  if (percent >= 100) return "exhausted";
  if (percent >= 80) return "warning";
  return "normal";
}

export const METER_COLORS: Record<MeterState, string> = {
  normal: "var(--color-fresco-tint)",
  warning: "var(--color-fresco-warning)",
  exhausted: "var(--color-fresco-error)",
};

export const METER_BG_COLORS: Record<MeterState, string> = {
  normal: "rgba(0, 153, 255, 0.12)",
  warning: "rgba(255, 207, 97, 0.12)",
  exhausted: "rgba(255, 106, 149, 0.12)",
};

// ---------------------------------------------------------------------------
// In-memory cache + event bus so all consumers stay in sync
// ---------------------------------------------------------------------------

const INVALIDATE_EVENT = "billing:usage:invalidate";

let cachedData: BillingUsageData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

// Sync subscription status from Dodo once per session (or on force refresh)
let lastSyncTimestamp = 0;
const SYNC_TTL = 300_000; // 5 minutes — don't hammer Dodo

async function syncSubscription(): Promise<void> {
  const now = Date.now();
  if (now - lastSyncTimestamp < SYNC_TTL) return;
  lastSyncTimestamp = now;
  try {
    await fetch("/api/billing/sync", { method: "POST" });
  } catch {
    // Swallow — sync is best-effort, usage fetch still works
  }
}

async function fetchUsage(force = false): Promise<BillingUsageData> {
  const now = Date.now();
  if (!force && cachedData && now - cacheTimestamp < CACHE_TTL) return cachedData;

  // Sync subscription status from Dodo before fetching usage
  if (force) lastSyncTimestamp = 0; // force sync too
  await syncSubscription();

  const res = await fetch("/api/billing/usage");
  if (!res.ok) throw new Error("Failed to fetch usage");
  const json = await res.json();
  cachedData = json;
  cacheTimestamp = now;
  return json;
}

/**
 * Call this after any action that changes token usage (e.g. a chat turn
 * completing). Every mounted `useBillingUsage` consumer will re-fetch.
 */
export function invalidateBillingUsage() {
  cacheTimestamp = 0;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(INVALIDATE_EVENT));
  }
}

export function useBillingUsage() {
  const [data, setData] = useState<BillingUsageData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState(false);

  const refresh = useCallback((force = false) => {
    fetchUsage(force)
      .then((d) => { setData(d); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Initial fetch
  useEffect(() => { refresh(); }, [refresh]);

  // Re-fetch when any component calls invalidateBillingUsage()
  useEffect(() => {
    const handler = () => refresh(true);
    window.addEventListener(INVALIDATE_EVENT, handler);
    return () => window.removeEventListener(INVALIDATE_EVENT, handler);
  }, [refresh]);

  // Re-fetch when user tabs back (e.g. after completing checkout in another tab)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") refresh(true);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [refresh]);

  return { data, loading, error };
}
