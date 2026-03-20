import Link from "next/link";

import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { LoadingLink } from "@/components/loading-link";
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
    <main className="min-h-screen min-h-dvh overflow-y-auto overscroll-none bg-[var(--background)] p-4 sm:p-7">
      <section className="rounded-none border border-fresco-divider bg-[linear-gradient(180deg,var(--color-fresco-frame-overlay),transparent),var(--color-fresco-panel)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="font-heading text-[15px] uppercase tracking-[0.08em] text-fresco-title"
            href="/"
          >
            Framer Bot
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isSignedIn ? (
              <>
                <Button asChild size="sm" variant="ghost">
                  <LoadingLink href="/dashboard">Dashboard</LoadingLink>
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
                  className="bg-fresco-primary-surface text-fresco-primary-surface-text shadow-[0_10px_28px_rgba(0,0,0,0.2)] hover:bg-fresco-primary-surface-hover"
                  size="sm"
                >
                  <Link href="/sign-up">Start free</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="max-w-3xl px-3 pt-18 pb-14">
          <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">AI-Native Framer Ops</span>
          <h1 className="mt-3 font-heading text-[clamp(40px,7vw,76px)] leading-[0.98] tracking-[-0.04em] text-fresco-title">
            Framer on steroids for AI-native teams shipping faster together.
          </h1>
          <p className="mt-4 text-base leading-7 text-fresco-description">
            Framer Bot gives your team an AI-native control room for Framer CMS:
            faster content ops, shared workflows, and a clean workspace for the
            people who actually ship updates every day.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              className="bg-fresco-primary-surface text-fresco-primary-surface-text shadow-[0_10px_28px_rgba(0,0,0,0.2)] hover:bg-fresco-primary-surface-hover"
              size="lg"
            >
              <LoadingLink href={isSignedIn ? "/dashboard" : "/sign-up"}>
                {isSignedIn ? "Go to dashboard" : "Create account"}
              </LoadingLink>
            </Button>
            <Button asChild size="lg" variant="outline">
              <LoadingLink href="/onboarding">View setup flow</LoadingLink>
            </Button>
          </div>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-3">
          <article className="rounded-none border border-fresco-divider bg-fresco-surface-subtle min-h-40 p-[18px]">
            <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">One fast setup</span>
            <p className="mt-3 text-sm leading-6 text-fresco-description">
              Paste a Framer API key, validate the project, choose a collection,
              and Framer Bot takes over the operating layer.
            </p>
          </article>
          <article className="rounded-none border border-fresco-divider bg-fresco-surface-subtle min-h-40 p-[18px]">
            <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">Built for team members</span>
            <p className="mt-3 text-sm leading-6 text-fresco-description">
              Keep permissions lean. Admins connect Framer, invite teammates,
              and let writers, editors, and operators move without friction.
            </p>
          </article>
          <article className="rounded-none border border-fresco-divider bg-fresco-surface-subtle min-h-40 p-[18px]">
            <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">AI-native by default</span>
            <p className="mt-3 text-sm leading-6 text-fresco-description">
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
