"use client";

import { Button } from "@/components/ui/button";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
import { formatErrorMessage } from "@/lib/error-display";
import { isTransientFramerMessage } from "@/lib/framer-copy";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const formattedMessage = formatErrorMessage(error.message);

  if (isTransientFramerMessage(formattedMessage)) {
    return <FramerTemporaryUnavailableState onRetry={reset} />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-7">
      <section className="rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)] mx-auto flex w-full max-w-3xl flex-col gap-4 p-7">
        <span className="inline-flex items-center rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--framer-fresco-panelSubtitle-color)] w-fit">Something Broke</span>
        <h1 className="font-heading text-[clamp(36px,7vw,56px)] leading-[1.1] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
          The dashboard hit an unexpected error.
        </h1>
        <pre className="rounded-none border border-[var(--framer-app-accent-callout-border-color)] bg-[var(--framer-app-accent-callout-background-color)] px-4 py-3 font-mono text-sm text-[color:var(--framer-app-accent-callout-text-color)] whitespace-pre-wrap">
          {formattedMessage}
        </pre>
        <div>
          <Button onClick={reset} type="button">
            Try again
          </Button>
        </div>
      </section>
    </div>
  );
}
