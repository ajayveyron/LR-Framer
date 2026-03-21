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
      <section className="rounded-none border border-fresco-divider bg-[var(--color-fresco-panel)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] mx-auto max-w-7xl">
        {/* ---- Nav ---- */}
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

        {/* ---- Hero ---- */}
        <div className="max-w-3xl px-3 pt-18 pb-14">
          <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">
            Team CMS Workflow
          </span>
          <h1 className="mt-3 font-heading text-[clamp(40px,7vw,76px)] leading-[0.98] tracking-[-0.04em] text-fresco-title">
            Run your Framer CMS with your team, outside the editor.
          </h1>
          <p className="mt-4 text-base leading-7 text-fresco-description">
            Give your team a shared workspace for Framer CMS content. Use AI to
            rewrite, review, and batch-improve posts faster, without giving
            everyone full Framer editor access.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              className="bg-fresco-primary-surface text-fresco-primary-surface-text shadow-[0_10px_28px_rgba(0,0,0,0.2)] hover:bg-fresco-primary-surface-hover"
              size="lg"
            >
              <LoadingLink href={isSignedIn ? "/dashboard" : "/sign-up"}>
                Start free
              </LoadingLink>
            </Button>
            <Button asChild size="lg" variant="outline">
              <LoadingLink href="/onboarding">See setup flow</LoadingLink>
            </Button>
          </div>
        </div>

        {/* ---- Value Props ---- */}
        <div className="grid gap-3.5 lg:grid-cols-3">
          <article className="rounded-none border border-fresco-divider bg-fresco-surface-subtle min-h-40 p-[18px]">
            <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">
              Connect one Framer site fast
            </span>
            <p className="mt-3 text-sm leading-6 text-fresco-description">
              Paste a Framer API key, validate the project, choose a collection,
              and your team workspace is ready in under a minute.
            </p>
          </article>
          <article className="rounded-none border border-fresco-divider bg-fresco-surface-subtle min-h-40 p-[18px]">
            <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">
              Invite your internal team
            </span>
            <p className="mt-3 text-sm leading-6 text-fresco-description">
              Marketers, writers, and editors get a clean CMS view. No Framer
              editor access needed. Admins stay in control.
            </p>
          </article>
          <article className="rounded-none border border-fresco-divider bg-fresco-surface-subtle min-h-40 p-[18px]">
            <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">
              Use AI to edit and review faster
            </span>
            <p className="mt-3 text-sm leading-6 text-fresco-description">
              Rewrite posts, review content, and batch-improve titles or
              descriptions with AI built into the workflow.
            </p>
          </article>
        </div>

        {/* ---- How It Works ---- */}
        <div className="mt-16 px-3">
          <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">
            How it works
          </span>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "1", title: "Sign up", desc: "Create a free account in seconds." },
              { step: "2", title: "Connect Framer", desc: "Paste your API key and pick a collection." },
              { step: "3", title: "Invite your team", desc: "Add teammates who need CMS access." },
              { step: "4", title: "Ship content", desc: "Edit, rewrite with AI, and publish." },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-fresco-divider bg-fresco-surface-muted text-xs font-medium text-fresco-tint">
                  {item.step}
                </span>
                <h3 className="text-sm font-medium text-fresco-title">{item.title}</h3>
                <p className="text-sm leading-6 text-fresco-description">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Who It's For ---- */}
        <div className="mt-16 px-3">
          <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">
            Who it&apos;s for
          </span>
          <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
            {[
              { title: "Startup marketing teams", desc: "Stop being the Framer bottleneck. Let your team manage CMS content directly." },
              { title: "Founders shipping content", desc: "Delegate content updates without giving away full editor access." },
              { title: "Small internal teams", desc: "One Framer site, shared editing, AI-assisted workflows." },
              { title: "Freelancers with clients", desc: "Manage one active content workflow for a client without the complexity." },
            ].map((item) => (
              <div key={item.title} className="rounded-none border border-fresco-divider bg-fresco-surface-subtle p-[18px]">
                <h3 className="text-sm font-medium text-fresco-title">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-fresco-description">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Pricing ---- */}
        <div className="mt-16 px-3" id="pricing">
          <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">
            Pricing
          </span>
          <div className="mt-6 grid gap-3.5 lg:grid-cols-3">
            {/* Free */}
            <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle p-6 flex flex-col gap-4">
              <div>
                <h3 className="text-base font-medium text-fresco-title">Free</h3>
                <p className="mt-1 text-2xl font-heading tracking-tight text-fresco-title">$0<span className="text-sm font-normal text-fresco-description">/mo</span></p>
              </div>
              <p className="text-sm leading-6 text-fresco-description">
                Prove the workflow on a real Framer project before paying.
              </p>
              <ul className="grid gap-2 text-sm text-fresco-description" role="list">
                <li>1 workspace, 1 Framer project</li>
                <li>Basic CMS view and edit</li>
                <li>1 invited teammate</li>
                <li>Small AI allowance</li>
              </ul>
              <div className="mt-auto pt-2">
                <Button asChild variant="outline" className="w-full">
                  <LoadingLink href={isSignedIn ? "/dashboard" : "/sign-up"}>
                    Get started
                  </LoadingLink>
                </Button>
              </div>
            </div>

            {/* Standard — highlighted */}
            <div className="rounded-none border-2 border-fresco-tint bg-fresco-surface-subtle p-6 flex flex-col gap-4 relative">
              <span className="absolute -top-3 left-4 rounded-none bg-fresco-tint px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#000]">
                Recommended
              </span>
              <div>
                <h3 className="text-base font-medium text-fresco-title">Standard</h3>
                <p className="mt-1 text-2xl font-heading tracking-tight text-fresco-title">$19<span className="text-sm font-normal text-fresco-description">/mo</span></p>
              </div>
              <p className="text-sm leading-6 text-fresco-description">
                Run one Framer site with your team and a meaningful AI boost.
              </p>
              <ul className="grid gap-2 text-sm text-fresco-description" role="list">
                <li>1 workspace, 1 Framer project</li>
                <li>Unlimited members</li>
                <li>Shared CMS editing</li>
                <li>AI rewrite, review, and batch-assist</li>
                <li>Moderate AI allowance</li>
              </ul>
              <div className="mt-auto pt-2">
                <Button
                  asChild
                  className="w-full bg-fresco-primary-surface text-fresco-primary-surface-text shadow-[0_10px_28px_rgba(0,0,0,0.2)] hover:bg-fresco-primary-surface-hover"
                >
                  <LoadingLink href={isSignedIn ? "/dashboard/billing" : "/sign-up"}>
                    Start free, upgrade anytime
                  </LoadingLink>
                </Button>
              </div>
            </div>

            {/* Agency — coming later */}
            <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle p-6 flex flex-col gap-4 opacity-70">
              <div>
                <h3 className="text-base font-medium text-fresco-title">Agency</h3>
                <p className="mt-1 text-2xl font-heading tracking-tight text-fresco-subtitle">$49<span className="text-sm font-normal text-fresco-description">/mo</span></p>
              </div>
              <p className="text-sm leading-6 text-fresco-description">
                Multiple workspaces, bigger AI allowance, and agency-friendly controls. Coming soon.
              </p>
              <ul className="grid gap-2 text-sm text-fresco-description" role="list">
                <li>Multiple workspaces or Framer projects</li>
                <li>Larger AI allowance</li>
                <li>Stronger admin controls</li>
                <li>Client management</li>
              </ul>
              <div className="mt-auto pt-2">
                <Button variant="outline" className="w-full" disabled>
                  Coming soon
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ---- FAQ ---- */}
        <div className="mt-16 mb-12 px-3">
          <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">
            FAQ
          </span>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {[
              {
                q: "Why do I need this if I already use Framer?",
                a: "Framer Bot lets your team manage CMS content without needing full Framer editor access. It removes the bottleneck of one person handling all content updates.",
              },
              {
                q: "What does unlimited members mean on Standard?",
                a: "Every teammate you invite can view and edit CMS content. There is no per-seat charge on the Standard plan.",
              },
              {
                q: "How does the AI allowance work?",
                a: "Each plan includes a monthly token allowance for AI features like rewrite, review, and batch edits. When it runs out, AI features pause until the next cycle.",
              },
              {
                q: "Is the Agency plan available yet?",
                a: "Not yet. Agency is on the roadmap for teams that need multiple workspaces or Framer projects. Standard covers one site with unlimited members today.",
              },
            ].map((item) => (
              <div key={item.q} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-fresco-title">{item.q}</h3>
                <p className="text-sm leading-6 text-fresco-description">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
