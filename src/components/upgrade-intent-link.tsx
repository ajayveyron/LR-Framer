"use client";

import { LoadingLink } from "@/components/loading-link";

/**
 * Landing-page CTA that persists an upgrade intent in localStorage
 * so the post-onboarding flow can auto-trigger Dodo checkout.
 */
export function UpgradeIntentLink({ href }: { href: string }) {
  return (
    <LoadingLink
      href={href}
      className="mt-8 block w-full rounded-full bg-[#FAFAFA] px-4 py-2.5 text-center text-[14px] font-medium text-[#0A0A0A] transition-transform hover:scale-105"
      onClick={() => {
        try {
          localStorage.setItem("upgrade_intent", "standard");
        } catch {}
      }}
    >
      Start Standard
    </LoadingLink>
  );
}
