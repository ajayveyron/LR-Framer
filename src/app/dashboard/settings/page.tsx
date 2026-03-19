import Link from "next/link";

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { SiteSettingsForm } from "@/components/site-settings-form";
import { TeamManager } from "@/components/team-manager";
import { UsageMeter } from "@/components/usage-meter";
import { Button } from "@/components/ui/button";
import { getDashboardAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  const isAdmin = access.role === "admin";

  return (
    <main className="settings-shell">
      <section className="mx-auto grid w-full max-w-6xl gap-10">
        <div className="flex items-center gap-4">
          <Button asChild className="size-10 rounded-full p-0" size="icon-lg" variant="outline">
            <Link aria-label="Back to dashboard" href="/dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="settings-heading">Settings</h1>
        </div>

        <SiteSettingsForm
          canManage={isAdmin}
          initialCollectionId={access.site.framerCollectionId ?? ""}
          initialCollectionName={access.site.framerCollectionName ?? ""}
          initialProjectInput={
            access.site.framerProjectUrl ?? access.site.framerProjectId ?? ""
          }
        />

        <div className="settings-section grid gap-6">
          <h2 className="settings-heading">AI Usage &amp; Billing</h2>
          <UsageMeter isAdmin={isAdmin} />
        </div>

        {isAdmin && (
          <div className="settings-section grid gap-6">
            <h2 className="settings-heading">Team</h2>
            <TeamManager />
          </div>
        )}
      </section>
    </main>
  );
}
