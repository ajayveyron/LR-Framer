import { Suspense } from "react";

import { AutoCheckoutTrigger } from "@/components/auto-checkout-trigger";
import { UsageMeter } from "@/components/usage-meter";

export default function BillingPage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-7">
      <Suspense>
        <AutoCheckoutTrigger />
      </Suspense>
      <section className="grid w-full gap-10">
        <div className="grid gap-2">
          <h1 className="font-sans text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-fresco-title">Usage &amp; Billing</h1>
          <p className="max-w-2xl text-sm text-fresco-description">
            Monitor AI usage for the workspace and manage the subscription when
            admin access is available.
          </p>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid gap-6">
          <UsageMeter />
        </div>
      </section>
    </main>
  );
}
