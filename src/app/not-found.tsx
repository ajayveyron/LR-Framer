import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto my-14 w-[min(620px,calc(100vw-32px))]">
      <section className="framer-card flex flex-col gap-4 p-7">
        <span className="framer-kicker w-fit">Not Found</span>
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
