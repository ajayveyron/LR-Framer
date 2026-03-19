import Link from "next/link";

import { SignOutButton } from "@clerk/nextjs";
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
            Framer Bot
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isSignedIn ? (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <SignOutButton redirectUrl="/">
                  <Button size="sm" variant="outline">Log out</Button>
                </SignOutButton>
              </>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button
                  asChild
                  className="framer-primary-action"
                  size="sm"
                >
                  <Link href="/sign-up">Start free</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="max-w-3xl px-3 pt-18 pb-14">
          <span className="framer-kicker">AI-Native Framer Ops</span>
          <h1 className="mt-3 font-heading text-[clamp(40px,7vw,76px)] leading-[0.98] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
            Framer on steroids for AI-native teams shipping faster together.
          </h1>
          <p className="mt-4 text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
            Framer Bot gives your team an AI-native control room for Framer CMS:
            faster content ops, shared workflows, and a clean workspace for the
            people who actually ship updates every day.
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
            <span className="framer-kicker">One fast setup</span>
            <p className="mt-3 text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
              Paste a Framer API key, validate the project, choose a collection,
              and Framer Bot takes over the operating layer.
            </p>
          </article>
          <article className="framer-subtle-panel min-h-40 p-[18px]">
            <span className="framer-kicker">Built for team members</span>
            <p className="mt-3 text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
              Keep permissions lean. Admins connect Framer, invite teammates,
              and let writers, editors, and operators move without friction.
            </p>
          </article>
          <article className="framer-subtle-panel min-h-40 p-[18px]">
            <span className="framer-kicker">AI-native by default</span>
            <p className="mt-3 text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
              AI workflows, content operations, and your existing backend syncs
              live in one place, so the team works with Framer instead of
              around it.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
