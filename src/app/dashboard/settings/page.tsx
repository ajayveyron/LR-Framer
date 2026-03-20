import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { SiteSettingsForm } from "@/components/site-settings-form";
import { getDashboardAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  return (
    <main className="dashboard-page-shell">
      <section className="mx-auto grid w-full max-w-6xl gap-10">
        <div className="grid gap-2">
          <h1 className="settings-heading">Settings</h1>
          <p className="max-w-2xl text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
            Configure the Framer workspace and default collection for this
            team.
          </p>
        </div>

        <SiteSettingsForm
          canManage={access.role === "admin"}
          initialCollectionId={access.site.framerCollectionId ?? ""}
          initialCollectionName={access.site.framerCollectionName ?? ""}
          initialProjectInput={
            access.site.framerProjectUrl ?? access.site.framerProjectId ?? ""
          }
        />
      </section>
    </main>
  );
}
