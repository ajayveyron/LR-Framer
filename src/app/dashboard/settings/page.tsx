import Link from "next/link";

import { SignOutButton, UserProfile } from "@clerk/nextjs";

import { SiteSettingsForm } from "@/components/site-settings-form";
import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { Button } from "@/components/ui/button";
import { getDashboardAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  return (
    <main className="framer-shell">
      <section className="framer-frame mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <span className="framer-kicker">Settings</span>
            <h1 className="mt-3 font-heading text-[clamp(34px,5vw,58px)] leading-[1.02] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
              Manage your account and workspace
            </h1>
            <p className="mt-4 text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
              Update the active Framer connection, open your profile, manage the
              team, or end the current session.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="grid gap-6">
            <SiteSettingsForm
              canManage={access.role === "admin"}
              initialCollectionId={access.site.framerCollectionId ?? ""}
              initialCollectionName={access.site.framerCollectionName ?? ""}
              initialProjectInput={
                access.site.framerProjectUrl ?? access.site.framerProjectId ?? ""
              }
            />

            <section className="framer-subtle-panel grid gap-4 p-5">
              <div>
                <span className="framer-kicker">Workspace</span>
                <h2 className="mt-3 font-heading text-3xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]">
                  Quick actions
                </h2>
                <p className="mt-3 text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
                  {access.site.name} is connected to{" "}
                  {access.site.framerCollectionName} in Framer.
                </p>
              </div>

              <div className="grid gap-3">
                {access.role === "admin" ? (
                  <Button asChild className="h-11 justify-start px-4" variant="outline">
                    <Link href="/dashboard/settings/team">Manage team</Link>
                  </Button>
                ) : null}
                <SignOutButton>
                  <Button className="h-11 justify-start px-4" type="button" variant="destructive">
                    Log out
                  </Button>
                </SignOutButton>
              </div>

              <dl className="grid gap-3 text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
                    Team
                  </dt>
                  <dd className="text-[color:var(--framer-fresco-panelTitle-color)]">
                    {access.site.name}
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
                    Role
                  </dt>
                  <dd className="text-[color:var(--framer-fresco-panelTitle-color)]">
                    {access.role === "admin" ? "Admin" : "Contributor"}
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
                    Collection
                  </dt>
                  <dd className="text-[color:var(--framer-fresco-panelTitle-color)]">
                    {access.site.framerCollectionName}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="framer-subtle-panel overflow-hidden p-3">
            <UserProfile routing="hash" />
          </section>
        </div>
      </section>
    </main>
  );
}
