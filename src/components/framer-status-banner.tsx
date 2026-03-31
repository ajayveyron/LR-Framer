"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, Warning } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

type RetryState = "idle" | "retrying" | "failed";

export function FramerStatusBanner({
  cachedAt: _cachedAt,
  state: _state,
}: {
  cachedAt: string | null;
  state: "stale" | "unavailable";
}) {
  const router = useRouter();
  const [retryState, setRetryState] = useState<RetryState>("idle");
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRetry = useCallback(() => {
    if (retryState === "retrying") return;

    if (failTimerRef.current) {
      clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }

    setRetryState("retrying");

    // Attempt to ping the server — if still on the same page after refresh,
    // it means the connection still failed (banner is only rendered when unavailable).
    router.refresh();

    // If the banner is still mounted after a delay, the retry failed.
    const timeout = setTimeout(() => {
      setRetryState("failed");
      failTimerRef.current = setTimeout(() => {
        setRetryState("idle");
        failTimerRef.current = null;
      }, 3000);
    }, 4000);

    failTimerRef.current = timeout;
  }, [retryState, router]);

  return (
    <div className={`border-fresco-warning-callout-border bg-[repeating-linear-gradient(-45deg,rgba(255,207,97,0.12)_0_14px,rgba(255,207,97,0.22)_14px_28px),rgba(245,158,11,0.14)] relative z-20 w-full overflow-x-hidden border-b text-fresco-title backdrop-blur-md`}>
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-wrap items-center justify-center gap-3 px-4 py-3 text-center md:px-6 md:text-left">
        <div className="min-w-0 max-w-full break-words">
          <p className="text-sm font-semibold">
            Framer Server API is temporarily unavailable.
          </p>
        </div>
        <Button
          className="max-w-full shrink-0"
          disabled={retryState === "retrying"}
          onClick={handleRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          {retryState === "retrying" && (
            <>
              <SpinnerGap className="size-3.5 animate-spin" />
              Retrying&hellip;
            </>
          )}
          {retryState === "failed" && (
            <>
              <Warning className="size-3.5" />
              Connection failed
            </>
          )}
          {retryState === "idle" && "Retry Framer connection"}
        </Button>
      </div>
    </div>
  );
}
