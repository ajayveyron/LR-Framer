import Link from "next/link";

import { auth } from "@clerk/nextjs/server";

import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function isClerkConfigured() {
  return Boolean(
    process.env.CLERK_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  );
}

export default async function MarketingHomePage() {
  let isSignedIn = false;

  if (isClerkConfigured()) {
    try {
      const { userId } = await auth();
      isSignedIn = Boolean(userId);
    } catch {
      isSignedIn = false;
    }
  }

  return (
    <main className="framer-shell">
      <section className="framer-frame mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="font-heading text-[15px] uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelTitle-color)]"
            href="/"
          >
            FramerLink
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="sm" variant="ghost">
              <Link href={isSignedIn ? "/dashboard" : "/sign-in"}>
                {isSignedIn ? "Dashboard" : "Sign in"}
              </Link>
            </Button>
            <Button
              asChild
              className="framer-primary-action"
              size="sm"
            >
              <Link href={isSignedIn ? "/dashboard" : "/sign-up"}>
                {isSignedIn ? "Open app" : "Start free"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="max-w-3xl px-3 pt-18 pb-14">
          <span className="framer-kicker">Framer CMS Ops</span>
          <h1 className="mt-3 font-heading text-[clamp(40px,7vw,76px)] leading-[0.98] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
            Invite contributors into Framer CMS workflows without buying more Framer seats.
          </h1>
          <p className="mt-4 text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
            FramerLink gives power Framer teams a clean third-party control
            panel for one user-managed CMS collection, with minimal onboarding
            and a product surface built for content contributors.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              className="framer-primary-action"
              size="lg"
            >
              <Link href={isSignedIn ? "/dashboard" : "/sign-up"}>
                {isSignedIn ? "Go to dashboard" : "Create account"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/onboarding">View setup flow</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-3">
          <article className="framer-subtle-panel min-h-40 p-[18px]">
            <span className="framer-kicker">One setup flow</span>
            <p className="mt-3 text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
              Paste a Framer API key, validate the project, choose a collection,
              and FramerLink takes over the content surface.
            </p>
          </article>
          <article className="framer-subtle-panel min-h-40 p-[18px]">
            <span className="framer-kicker">Admin + contributor</span>
            <p className="mt-3 text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
              Keep the permission model lean. Admins connect Framer and invite
              teammates. Contributors focus on content.
            </p>
          </article>
          <article className="framer-subtle-panel min-h-40 p-[18px]">
            <span className="framer-kicker">Legacy bridge preserved</span>
            <p className="mt-3 text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
              Your existing Notion to Framer webhook and sync pipeline stays
              alive in the backend while the product shell grows around it.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
