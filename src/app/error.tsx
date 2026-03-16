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
    <main className="login-shell">
      <section className="panel login-card stack">
        <span className="eyebrow">Something Broke</span>
        <h1 className="headline">The dashboard hit an unexpected error.</h1>
        <pre className="warning-banner mono" style={{ whiteSpace: "pre-wrap" }}>
          {formatErrorMessage(error.message)}
        </pre>
        <Button onClick={reset} type="button">
          Try again
        </Button>
      </section>
    </main>
  );
}
