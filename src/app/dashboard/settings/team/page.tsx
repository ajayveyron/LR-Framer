import Link from "next/link";

import { TeamManager } from "@/components/team-manager";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { SettingsNav } from "@/components/settings-nav";
import { Button } from "@/components/ui/button";
import { requireAdminAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const access = await requireAdminAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  return (
    <main className="framer-shell">
      <section className="mx-auto grid w-full max-w-6xl gap-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild className="size-10 rounded-full p-0" size="icon-lg" variant="outline">
            <Link aria-label="Back to dashboard" href="/dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3">
          <span className="framer-kicker w-fit">Settings</span>
          <h1 className="font-heading text-[clamp(28px,4vw,42px)] leading-[1.04] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
            Team
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
            Invite contributors and manage membership for {access.site.name}.
          </p>
        </div>

        <SettingsNav currentPath="/dashboard/settings/team" />

        <TeamManager />
      </section>
    </main>
  );
}
