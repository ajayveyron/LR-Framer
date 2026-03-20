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
    <div className="dashboard-page-shell">
      <section className="framer-card mx-auto flex w-full max-w-3xl flex-col gap-4 p-7">
        <span className="framer-kicker w-fit">Something Broke</span>
        <h1 className="font-heading text-[clamp(36px,7vw,56px)] leading-[1.1] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
          The dashboard hit an unexpected error.
        </h1>
        <pre className="framer-code-panel whitespace-pre-wrap">
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
