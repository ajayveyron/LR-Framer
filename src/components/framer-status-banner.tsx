"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function FramerStatusBanner({
  cachedAt: _cachedAt,
  state: _state,
}: {
  cachedAt: string | null;
  state: "stale" | "unavailable";
}) {
  const router = useRouter();

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
          onClick={() => router.refresh()}
          size="sm"
          type="button"
          variant="outline"
        >
          Retry Framer connection
        </Button>
      </div>
    </div>
  );
}
