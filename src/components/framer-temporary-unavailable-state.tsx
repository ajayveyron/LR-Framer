"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TRANSIENT_FRAMER_EDITOR_MESSAGE } from "@/lib/framer-copy";

export function FramerTemporaryUnavailableState({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  const router = useRouter();

  return (
    <section className="min-w-0 overflow-x-clip">
      <div className="min-h-[calc(100vh-180px)] min-w-0">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-20 md:px-8 md:py-24">
          <span className="framer-kicker w-fit">Framer Server API</span>
          <h1 className="font-heading text-[clamp(32px,6vw,48px)] leading-[1.05] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
            Framer Server API is temporarily unavailable.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
            {TRANSIENT_FRAMER_EDITOR_MESSAGE}
          </p>
          <p className="max-w-3xl text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
            The dashboard is still available, but Framer is not responding and
            no cached snapshot exists yet. Editing and publishing stay disabled
            until the connection recovers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => onRetry?.() ?? router.refresh()}
              type="button"
            >
              Retry Framer connection
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
