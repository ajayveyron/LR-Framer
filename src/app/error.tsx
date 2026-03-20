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
      <section className="framer-card flex flex-col gap-4 p-7">
        <span className="framer-kicker w-fit">Something Broke</span>
        <h1 className="font-heading text-[clamp(36px,7vw,56px)] leading-[1.1] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
          The app hit an unexpected error.
        </h1>
        <pre className="framer-code-panel whitespace-pre-wrap">
          {formattedMessage}
        </pre>
        <Button onClick={reset} type="button">
          Try again
        </Button>
      </section>
    </main>
  );
}
