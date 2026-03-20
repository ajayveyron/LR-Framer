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
    <main className="dashboard-page-shell">
      <section className="grid w-full gap-10">
        <div className="grid gap-2">
          <h1 className="settings-heading">Usage &amp; Billing</h1>
          <p className="max-w-2xl text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
            Monitor AI usage for the workspace and manage the subscription when
            admin access is available.
          </p>
        </div>

        <div className="settings-section grid gap-6">
          <UsageMeter isAdmin={access.role === "admin"} />
        </div>
      </section>
    </main>
  );
}
