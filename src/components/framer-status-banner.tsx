"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

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
    <div className="framer-striped-banner fixed top-0 right-0 left-0 z-[60] overflow-x-hidden border-b text-[color:var(--framer-fresco-panelTitle-color)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-wrap items-center justify-center gap-3 px-4 py-3 text-center md:px-6 md:text-left">
        <div className="min-w-0 max-w-full break-words">
          <p className="text-sm font-semibold">
            Framer API is unresponsive. Content changes are temporarily
            disabled.
          </p>
          {/* <p className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
            {state === "stale"
              ? cachedLabel
                ? `Showing the last cached dashboard snapshot from ${cachedLabel}.`
                : "Showing the last cached dashboard snapshot."
              : "No cached dashboard snapshot is available yet."}
          </p> */}
        </div>
        <Button
          className="max-w-full shrink-0"
          onClick={() => router.refresh()}
          size="sm"
          type="button"
          variant="outline"
        >
          Retry connection
        </Button>
      </div>
    </div>
  );
}
