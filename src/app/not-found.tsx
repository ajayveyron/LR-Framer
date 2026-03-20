import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto my-14 w-[min(620px,calc(100vw-32px))]">
      <section className="rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)] flex flex-col gap-4 p-7">
        <span className="inline-flex items-center rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--framer-fresco-panelSubtitle-color)] w-fit">Not Found</span>
        <h1 className="font-heading text-[clamp(36px,7vw,56px)] leading-[1.1] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
          The requested post could not be found.
        </h1>
        <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
          It may have been removed from Framer or the URL is stale.
        </p>
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </section>
    </main>
  );
}
