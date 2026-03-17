"use client";

import { Button } from "@/components/ui/button";

function formatErrorMessage(message: string) {
  try {
    const parsed = JSON.parse(message) as Array<{
      message?: string;
      path?: Array<string | number>;
    }>;

    if (Array.isArray(parsed)) {
      return parsed
        .map((issue) => {
          const path = issue.path?.join(".") ?? "error";
          return `${path}: ${issue.message ?? "Invalid value"}`;
        })
        .join("\n");
    }
  } catch {}

  return message;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto my-14 w-[min(620px,calc(100vw-32px))]">
      <section className="framer-card flex flex-col gap-4 p-7">
        <span className="framer-kicker w-fit">Something Broke</span>
        <h1 className="font-heading text-[clamp(36px,7vw,56px)] leading-[1.1] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
          The dashboard hit an unexpected error.
        </h1>
        <pre className="framer-code-panel whitespace-pre-wrap">
          {formatErrorMessage(error.message)}
        </pre>
        <Button onClick={reset} type="button">
          Try again
        </Button>
      </section>
    </main>
  );
}
