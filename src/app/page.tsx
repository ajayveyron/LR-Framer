import Link from "next/link";
import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { LoadingLink } from "@/components/loading-link";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/fade-in";
import { UpgradeIntentLink } from "@/components/upgrade-intent-link";

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
    <main className="h-screen h-dvh overflow-y-auto scroll-smooth bg-[#0A0A0A] text-[#FAFAFA] antialiased selection:bg-fresco-tint selection:text-black">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        
        {/* ---- Nav ---- */}
        <nav className="flex items-center justify-between py-6 sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md">
          <Link
            className="flex items-center gap-2"
            href="/"
          >
            <Image
              alt="Framer Bot"
              draggable={false}
              height={32}
              priority
              src={process.env.NODE_ENV === "development" ? "/logo-dev.png" : "/logo.png"}
              style={{ width: "auto", height: 32 }}
              width={128}
            />
            <span className="select-none text-[15px] font-semibold tracking-[-0.02em] text-[#FAFAFA]">FramerBot</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-[14px] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-[14px] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">How it works</Link>
            <Link href="#pricing" className="text-[14px] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-5">
            {isSignedIn ? (
              <>
                <SignOutButton redirectUrl="/">
                  <button className="text-[14px] font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">Log out</button>
                </SignOutButton>
                <LoadingLink 
                  href="/dashboard" 
                  className="group relative inline-flex items-center justify-center rounded-full bg-[#FAFAFA] px-5 py-2 text-[14px] font-medium text-[#0A0A0A] transition-all hover:scale-105 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  Dashboard
                </LoadingLink>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="text-[14px] font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Sign in
                </Link>
                <Link 
                  href="/sign-up" 
                  className="group relative inline-flex items-center justify-center rounded-full bg-[#FAFAFA] px-5 py-2 text-[14px] font-medium text-[#0A0A0A] transition-all hover:scale-105 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  Start free
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* ---- Hero Section ---- */}
        <div className="relative pt-24 pb-32 sm:pt-32 sm:pb-40 text-center flex flex-col items-center">
          {/* Subtle glow behind hero */}
          <div className="absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#3B82F6]/20 blur-[120px] rounded-full point-events-none" />

          {/* Badge */}
          <FadeIn delay={0}>
            <div className="mb-8 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#A1A1AA] backdrop-blur-md">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#3B82F6] mr-2 animate-pulse"></span>
              AI-native content workflows for Framer
            </div>
          </FadeIn>
          
          <FadeIn delay={100}>
            <h1 className="text-[#5a5a5a] sm:text-6xl md:text-5xl font-medium tracking-tight text-balance leading-[1.05]">
              Superpower your <br className="hidden sm:block" />
              <span className="text-[#fff]">Framer Workflows</span><br className="hidden sm:block" />
              with AI & unlimited editors
            </h1>
          </FadeIn>
          
          <FadeIn delay={200}>
            <p className="mt-8 text-lg sm:text-xl leading-relaxed text-[#A1A1AA] max-w-2xl text-balance">
              A unified workspace where your team and AI work seamlessly together. 
              Effortlessly manage Framer CMS, batch-generate SEO metadata, and ship updates securely.
            </p>
          </FadeIn>
          
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <LoadingLink 
                href={isSignedIn ? "/dashboard" : "/sign-up"}
                className="group relative inline-flex items-center justify-center rounded-full bg-[#FAFAFA] px-8 py-3.5 text-[15px] font-medium text-[#0A0A0A] transition-all hover:scale-105 w-full sm:w-auto overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                Start free
              </LoadingLink>
              <LoadingLink 
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-[15px] font-medium text-[#FAFAFA] backdrop-blur-md transition-colors hover:bg-white/10 w-full sm:w-auto"
              >
                See setup flow
              </LoadingLink>
            </div>
          </FadeIn>

          {/* Floating Hero Mockup Image Placeholder */}
          <FadeIn delay={400} className="relative mt-20 w-full max-w-5xl mx-auto">
            <div className="absolute -inset-1 rounded-[24px] bg-gradient-to-b from-white/15 to-transparent blur-md opacity-50" />
            <div className="relative rounded-[20px] border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden aspect-[16/9] sm:aspect-[21/9] flex flex-col">
              {/* Mockup Top Bar */}
              <div className="flex items-center gap-2 px-4 h-10 border-b border-white/10 bg-white/5 backdrop-blur-md">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <div className="ml-4 h-4 w-48 rounded-md bg-white/5" />
              </div>
              <img 
                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=2000&h=1000" 
                alt="Hero Abstract" 
                className="w-full h-full object-cover opacity-90"
              />
            </div>
          </FadeIn>
        </div>

        {/* ---- Value Props / Bento Grids ---- */}
        <div className="py-24 sm:py-32" id="features">
          <FadeIn className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#FAFAFA]">
              Everything you need in a modern workspace
            </h2>
            <p className="mt-4 text-lg text-[#A1A1AA]">
              Purpose-built tools designed to make Framer CMS management effortless for teams.
            </p>
          </FadeIn>

          <FadeIn delay={200} className="grid gap-6 md:grid-cols-3 md:grid-rows-2">
            
            {/* Bento Card 1 - 1 col */}
            <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#111111] p-8 flex flex-col justify-between">
              <div className="absolute inset-0 bg-gradient-to-bl from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                  <svg className="h-6 w-6 text-[#A1A1AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-[#FAFAFA]">Connect Framer</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#A1A1AA]">
                  Paste your API key, pick your collection, and your secure workspace is ready instantly.
                </p>
              </div>
            </div>

            {/* Bento Card 2 (AI) - Full Width across 2 cols */}
            <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#111111] p-8 md:col-span-2 flex flex-col justify-between overflow-hidden">
              <div className="absolute inset-0 transition-opacity group-hover:opacity-100 opacity-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent)]" />
              
              <div className="relative z-10 grid sm:grid-cols-2 gap-8 items-center h-full">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                    <svg className="h-6 w-6 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-[#FAFAFA]">Native AI Superpowers</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#A1A1AA]">
                    Don't just edit—generate. Batch-rewrite titles, extract SEO descriptions, and structure drafts automatically with our embedded AI engine. 
                  </p>
                </div>
                <div className="relative h-48 w-full rounded-xl border border-white/10 bg-black/50 overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=800&h=400" 
                    alt="AI Generating Content" 
                    className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              </div>
            </div>

            {/* Bento Card 3 - 1 col */}
            <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#111111] p-8 flex flex-col justify-between">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)] opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                  <svg className="h-6 w-6 text-[#A1A1AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-[#FAFAFA]">Invite your team</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#A1A1AA]">
                  Writers and reviewers get a clean CMS view. No Framer editor access needed.
                </p>
              </div>
            </div>

            {/* Bento Card 4 - Full Width across 2 cols */}
            <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#111111] p-8 md:col-span-2 flex flex-col justify-center overflow-hidden">
              <div className="absolute inset-0 transition-opacity group-hover:opacity-100 opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.1),transparent)]" />
              
              <div className="relative z-10 grid sm:grid-cols-2 gap-8 items-center h-full">
                <div>
                   <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                    <svg className="h-6 w-6 text-[#A1A1AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-[#FAFAFA]">Ship Content Frictionless</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#A1A1AA]">
                    Your single source of truth for the Framer site. Create, draft, and publish completely outside the editor.
                  </p>
                </div>
                <div className="relative h-48 w-full rounded-xl border border-white/10 bg-black/50 overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&q=80&w=800&h=400" 
                    alt="Ship Content Abstract" 
                    className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              </div>
            </div>

          </FadeIn>
        </div>

        <hr className="border-white/10" />

        {/* ---- How It Works ---- */}
        <div className="py-24 sm:py-32" id="how-it-works">
          <FadeIn className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#FAFAFA]">
              How it works
            </h2>
            <p className="mt-4 text-lg text-[#A1A1AA]">
              A streamlined onboarding process gets you up and running with your Framer CMS in minutes.
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Sign up", desc: "Create a free account in seconds." },
              { step: "02", title: "Connect Framer", desc: "Paste your API key and pick a collection." },
              { step: "03", title: "Generate & Review", desc: "Use AI to batch-rewrite titles or draft SEO metadata globally." },
              { step: "04", title: "Ship instantly", desc: "Push updates back to your live Framer site safely." },
            ].map((item, index) => (
              <FadeIn key={item.step} delay={index * 150} direction="up" className="flex flex-col gap-5 p-8 rounded-[24px] border border-white/10 bg-[#111111]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[15px] font-medium text-[#FAFAFA]">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-medium text-[#FAFAFA]">{item.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#A1A1AA]">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        <hr className="border-white/10" />

        {/* ---- Who It's For ---- */}
        <div className="py-24 sm:py-32">
          <FadeIn className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#FAFAFA]">
              Who it's for
            </h2>
            <p className="mt-4 text-lg text-[#A1A1AA]">
              Built for teams who want to move fast without sharing master keys to the website.
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "Startup marketing", desc: "Stop the bottleneck. Batch-generate SEO metadata and manage content directly." },
              { title: "Founders", desc: "Ship blogs 10x faster with AI drafting inside a clean workspace without editor risks." },
              { title: "Internal teams", desc: "A unified platform for shared writing, AI review, and rapid CMS syncing." },
              { title: "Freelancers", desc: "Automate tedious SEO updates for client projects and manage their CMS safely." },
            ].map((item, index) => (
              <FadeIn key={item.title} delay={index * 150} direction="up" className="p-8 rounded-[24px] border border-white/10 bg-[#111111]">
                <h3 className="text-xl font-medium text-[#FAFAFA]">{item.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#A1A1AA]">{item.desc}</p>
              </FadeIn>
            ))}
          </div>
        </div>

        <hr className="border-white/10" />

        {/* ---- Pricing ---- */}
        <div className="py-24 sm:py-32" id="pricing">
          <FadeIn className="mb-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#FAFAFA]">Simple pricing</h2>
            <p className="mt-4 text-lg text-[#A1A1AA]">Start for free, upgrade when you need more power.</p>
          </FadeIn>

          <FadeIn delay={200} className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <div className="flex flex-col rounded-[24px] border border-white/10 bg-[#111111] p-8">
              <h3 className="text-[15px] font-medium text-[#A1A1AA]">Free</h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-medium tracking-tight text-[#FAFAFA]">$0</span>
                <span className="text-[14px] text-[#A1A1AA]">/month</span>
              </p>
              <p className="mt-4 text-[14px] leading-relaxed text-[#A1A1AA]">
                Prove the workflow on a real Framer project before paying.
              </p>
              <ul className="mt-8 space-y-3 text-[14px] text-[#FAFAFA] flex-1">
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> 1 workspace, 1 project</li>
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> Basic CMS view and edit</li>
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> 1 invited teammate</li>
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> Small AI allowance</li>
              </ul>
              <LoadingLink 
                href={isSignedIn ? "/dashboard" : "/sign-up"}
                className="mt-8 block w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-center text-[14px] font-medium text-[#FAFAFA] transition-colors hover:bg-white/10"
              >
                Get started
              </LoadingLink>
            </div>

            {/* Standard */}
            <div className="flex flex-col rounded-[24px] border border-white/20 bg-[#1A1A1A] p-8 relative shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3B82F6] px-3 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
                Recommended
              </div>
              <h3 className="text-[15px] font-medium text-[#FAFAFA]">Standard</h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-medium tracking-tight text-[#FAFAFA]">$19</span>
                <span className="text-[14px] text-[#A1A1AA]">/month</span>
              </p>
              <p className="mt-4 text-[14px] leading-relaxed text-[#A1A1AA]">
                Run one Framer site with your team and a meaningful AI boost.
              </p>
              <ul className="mt-8 space-y-3 text-[14px] text-[#FAFAFA] flex-1">
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> 1 workspace, 1 project</li>
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> Unlimited members</li>
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> Shared CMS editing</li>
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> AI rewrite, review, batch</li>
                <li className="flex gap-3"><span className="text-[#3B82F6]">✓</span> Moderate AI allowance</li>
              </ul>
              <UpgradeIntentLink 
                href={isSignedIn ? "/dashboard/billing?intent=upgrade" : "/sign-up?intent=upgrade"}
              />
            </div>

            {/* Agency */}
            <div className="flex flex-col rounded-[24px] border border-white/5 bg-[#0A0A0A] p-8 opacity-60">
              <h3 className="text-[15px] font-medium text-[#A1A1AA]">Agency</h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-medium tracking-tight text-[#FAFAFA]">$49</span>
                <span className="text-[14px] text-[#A1A1AA]">/month</span>
              </p>
              <p className="mt-4 text-[14px] leading-relaxed text-[#A1A1AA]">
                Multiple workspaces, bigger AI allowance, and agency controls.
              </p>
              <ul className="mt-8 space-y-3 text-[14px] text-[#FAFAFA] flex-1">
                <li className="flex gap-3"><span className="text-[#A1A1AA]">✓</span> Multiple workspaces</li>
                <li className="flex gap-3"><span className="text-[#A1A1AA]">✓</span> Larger AI allowance</li>
                <li className="flex gap-3"><span className="text-[#A1A1AA]">✓</span> Strong admin controls</li>
                <li className="flex gap-3"><span className="text-[#A1A1AA]">✓</span> Client management</li>
              </ul>
              <button 
                disabled
                className="mt-8 block w-full rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-center text-[14px] font-medium text-[#A1A1AA] cursor-not-allowed"
              >
                Coming soon
              </button>
            </div>
          </FadeIn>
        </div>
        
        <hr className="border-white/10" />

        {/* ---- Final CTA ---- */}
        <FadeIn delay={100} direction="none" className="relative py-24 sm:py-32 text-center flex flex-col items-center overflow-hidden rounded-[40px] border border-white/10 bg-[#111111] my-12">
          <div className="absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#3B82F6]/10 blur-[120px] rounded-full pointer-events-none" />
          
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-[#FAFAFA] text-balance max-w-3xl leading-[1.05]">
            Ready to deploy AI on your CMS?
          </h2>
          <p className="mt-6 text-lg text-[#A1A1AA] max-w-xl text-balance">
            Join the teams that are generating and shipping optimized Framer content 10x faster using our native AI engine.
          </p>
          <div className="mt-10">
            <LoadingLink 
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="group relative inline-flex items-center justify-center rounded-full bg-[#FAFAFA] px-10 py-4 text-[16px] font-medium text-[#0A0A0A] transition-all hover:scale-105 overflow-hidden shadow-[0_0_40px_rgba(250,250,250,0.3)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              Get started for free
            </LoadingLink>
          </div>
        </FadeIn>

        {/* ---- Footer ---- */}
        <footer className="py-12 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-white/10">
          <span className="text-[14px] text-[#A1A1AA]">
            &copy; {new Date().getFullYear()} Framer Bot Team. All rights reserved.
          </span>
          <div className="flex gap-6">
            <Link href="/" className="text-[14px] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
              Terms
            </Link>
            <Link href="/" className="text-[14px] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
              Privacy
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
