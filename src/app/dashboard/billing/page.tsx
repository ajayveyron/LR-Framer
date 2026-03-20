import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { UsageMeter } from "@/components/usage-meter";
import { getDashboardAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-7">
      <section className="grid w-full gap-10">
        <div className="grid gap-2">
          <h1 className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-fresco-title">Usage &amp; Billing</h1>
          <p className="max-w-2xl text-sm text-fresco-description">
            Monitor AI usage for the workspace and manage the subscription when
            admin access is available.
          </p>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid gap-6">
          <UsageMeter isAdmin={access.role === "admin"} />
        </div>
      </section>
    </main>
  );
}
