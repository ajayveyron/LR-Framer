"use client";

import Link from "next/link";

import { FramerStatusBanner } from "@/components/framer-status-banner";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
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

function isTransientFramerMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("no connection to the server") ||
    normalized.includes("framer is temporarily unavailable") ||
    normalized.includes("session expired") ||
    normalized.includes("project_closed")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const formattedMessage = formatErrorMessage(error.message);

  if (isTransientFramerMessage(formattedMessage)) {
    return (
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar hidden md:flex">
          <div className="grid gap-8">
            <div className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
                Workspace
              </span>
              <div className="grid gap-1">
                <span className="text-base font-semibold text-[color:var(--framer-fresco-panelTitle-color)]">
                  Dashboard
                </span>
                <span className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                  Framer temporarily unavailable
                </span>
              </div>
            </div>

            <nav aria-label="Dashboard sections" className="grid gap-1.5">
              <Link className="dashboard-sidebar-link dashboard-sidebar-link-active" href="/dashboard">
                Content
              </Link>
              <Link className="dashboard-sidebar-link" href="/dashboard/settings">
                Settings
              </Link>
              <Link className="dashboard-sidebar-link" href="/dashboard/team">
                Team
              </Link>
            </nav>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="dashboard-mobile-bar md:hidden">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
                Workspace
              </div>
              <div className="text-base font-semibold text-[color:var(--framer-fresco-panelTitle-color)]">
                Dashboard
              </div>
            </div>
          </div>

          <FramerStatusBanner cachedAt={null} state="unavailable" />
          <div className="dashboard-page-shell">
            <FramerTemporaryUnavailableState onRetry={reset} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <main className="mx-auto my-14 w-[min(620px,calc(100vw-32px))]">
      <section className="framer-card flex flex-col gap-4 p-7">
        <span className="framer-kicker w-fit">Something Broke</span>
        <h1 className="font-heading text-[clamp(36px,7vw,56px)] leading-[1.1] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
          The dashboard hit an unexpected error.
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
