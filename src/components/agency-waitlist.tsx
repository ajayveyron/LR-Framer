"use client";

import { useState } from "react";

export function AgencyWaitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitted">("idle");

  if (status === "submitted") {
    return (
      <p className="mt-8 text-center text-[13px] text-emerald-400">
        You&apos;re on the list. We&apos;ll reach out when Agency launches.
      </p>
    );
  }

  return (
    <form
      className="mt-8 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        // Fire-and-forget — no backend needed yet, just capture in analytics
        const w = window as unknown as { plausible?: (event: string, opts: { props: Record<string, string> }) => void };
        if (typeof window !== "undefined" && w.plausible) {
          w.plausible("Agency Waitlist", { props: { email } });
        }
        setStatus("submitted");
      }}
    >
      <input
        className="flex-1 rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-[13px] text-[#FAFAFA] placeholder:text-[#71717A] focus:border-white/30 focus:outline-none"
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        required
        type="email"
        value={email}
      />
      <button
        className="shrink-0 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-[13px] font-medium text-[#FAFAFA] transition-colors hover:bg-white/10"
        type="submit"
      >
        Notify me
      </button>
    </form>
  );
}
