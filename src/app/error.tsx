"use client";

import { Button } from "@/components/ui/button";
import { formatErrorMessage } from "@/lib/error-display";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const formattedMessage = formatErrorMessage(error.message);

  return (
    <main className="mx-auto my-14 w-[min(620px,calc(100vw-32px))]">
      <section className="rounded-none border border-fresco-divider bg-fresco-panel p-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)] flex flex-col gap-4 p-7">
        <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle w-fit">Something Broke</span>
        <h1 className="font-heading text-[clamp(36px,7vw,56px)] leading-[1.1] tracking-[-0.04em] text-fresco-title">
          The app hit an unexpected error.
        </h1>
        <pre className="rounded-none border border-fresco-accent-callout-border bg-fresco-accent-callout-bg px-4 py-3 font-mono text-sm text-fresco-accent-callout-text whitespace-pre-wrap">
          {formattedMessage}
        </pre>
        <Button onClick={reset} type="button">
          Try again
        </Button>
      </section>
    </main>
  );
}
