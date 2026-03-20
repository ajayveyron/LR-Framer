"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getFramerStatusDetail } from "@/lib/framer-copy";

function formatCachedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function FramerStatusBanner({
  cachedAt,
  state,
}: {
  cachedAt: string | null;
  state: "stale" | "unavailable";
}) {
  const router = useRouter();
  const cachedLabel = formatCachedAt(cachedAt);

  useEffect(() => {
    document.documentElement.classList.add("framer-status-banner-active");

    return () => {
      document.documentElement.classList.remove("framer-status-banner-active");
    };
  }, []);

  return (
    <div className={`border-fresco-warning-callout-border bg-[repeating-linear-gradient(-45deg,rgba(255,207,97,0.12)_0_14px,rgba(255,207,97,0.22)_14px_28px),rgba(245,158,11,0.14)] fixed top-0 right-0 left-0 z-[60] overflow-x-hidden border-b text-fresco-title backdrop-blur-md`}>
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-wrap items-center justify-center gap-3 px-4 py-3 text-center md:px-6 md:text-left">
        <div className="min-w-0 max-w-full break-words">
          <p className="text-sm font-semibold">
            Framer Server API is temporarily unavailable. FramerBot is still
            running normally.
          </p>
          <p className="text-sm text-fresco-description">
            {getFramerStatusDetail({ cachedLabel, state })}
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
