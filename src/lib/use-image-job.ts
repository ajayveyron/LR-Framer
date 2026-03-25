"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface ImageJobResult {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  error?: string;
  prompt?: string;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 min timeout

/**
 * Polls a background image generation job until it completes or fails.
 * Returns the latest job state.
 */
export function useImageJob(jobId: string | null): ImageJobResult | null {
  const [result, setResult] = useState<ImageJobResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;

    startRef.current = Date.now();

    async function poll() {
      try {
        const res = await fetch(`/api/ai/image/generate-async/${jobId}`);
        if (!res.ok) return;
        const data: ImageJobResult = await res.json();
        setResult(data);

        if (data.status === "completed" || data.status === "failed") {
          cleanup();
        }

        // Timeout safety
        if (Date.now() - startRef.current > MAX_POLL_DURATION_MS) {
          setResult((prev) =>
            prev?.status === "completed" || prev?.status === "failed"
              ? prev
              : { jobId: jobId!, status: "failed", error: "Image generation timed out." },
          );
          cleanup();
        }
      } catch {
        // Network error — keep polling
      }
    }

    // Initial poll
    void poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return cleanup;
  }, [jobId, cleanup]);

  return result;
}
