import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { TeamManager } from "@/components/team-manager";
import { requireAdminAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const access = await requireAdminAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  return (
    <main className="dashboard-page-shell">
      <section className="mx-auto grid w-full max-w-6xl gap-10">
        <div className="grid gap-2">
          <h1 className="settings-heading">Team</h1>
          <p className="max-w-2xl text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
            Manage members, invitations, and organization roles for this
            workspace.
          </p>
        </div>

        <div className="settings-section grid gap-6">
          <TeamManager />
        </div>
      </section>
    </main>
  );
}
