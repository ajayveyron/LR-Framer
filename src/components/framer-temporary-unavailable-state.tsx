"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function FramerTemporaryUnavailableState() {
  const router = useRouter();

  return (
    <main className="mx-auto my-14 w-[min(720px,calc(100vw-32px))]">
      <section className="framer-card flex flex-col gap-4 p-7">
        <span className="framer-kicker w-fit">Framer Reconnecting</span>
        <h1 className="font-heading text-[clamp(36px,7vw,56px)] leading-[1.1] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
          Framer is temporarily unavailable.
        </h1>
        <p className="text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
          The connection validated, but Framer briefly returned a session-expired
          response while the dashboard was loading. Retry in a few seconds.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => router.refresh()} type="button">
            Retry now
          </Button>
          <Button
            onClick={() => router.push("/onboarding")}
            type="button"
            variant="outline"
          >
            Back to setup
          </Button>
        </div>
      </section>
    </main>
  );
}
