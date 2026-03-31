"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, Warning } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { TRANSIENT_FRAMER_EDITOR_MESSAGE } from "@/lib/framer-copy";

type RetryState = "idle" | "retrying" | "failed";

export function FramerTemporaryUnavailableState({
  onRetry,
}: {
  onRetry?: () => void;
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

    if (onRetry) {
      onRetry();
    } else {
      router.refresh();
    }

    // If the component is still mounted after a delay, the retry failed.
    const timeout = setTimeout(() => {
      setRetryState("failed");
      failTimerRef.current = setTimeout(() => {
        setRetryState("idle");
        failTimerRef.current = null;
      }, 3000);
    }, 4000);

    failTimerRef.current = timeout;
  }, [retryState, router, onRetry]);

  return (
    <section className="min-w-0 overflow-x-clip">
      <div className="min-h-[calc(100vh-180px)] min-w-0">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-20 md:px-8 md:py-24">
          <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle w-fit">Framer Server API</span>
          <h1 className="font-heading text-[clamp(32px,6vw,48px)] leading-[1.05] tracking-[-0.04em] text-fresco-title">
            Framer Server API is temporarily unavailable.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-fresco-description">
            {TRANSIENT_FRAMER_EDITOR_MESSAGE}
          </p>
          <p className="max-w-3xl text-base leading-7 text-fresco-description">
            The dashboard is still available, but Framer is not responding and
            no cached snapshot exists yet. Editing and publishing stay disabled
            until the connection recovers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={retryState === "retrying"}
              onClick={handleRetry}
              type="button"
            >
              {retryState === "retrying" && (
                <>
                  <SpinnerGap className="size-4 animate-spin" />
                  Retrying&hellip;
                </>
              )}
              {retryState === "failed" && (
                <>
                  <Warning className="size-4" />
                  Connection failed
                </>
              )}
              {retryState === "idle" && "Retry Framer connection"}
            </Button>
            <Button
              onClick={() => router.push("/onboarding")}
              type="button"
              variant="outline"
            >
              Back to setup
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
