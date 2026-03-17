import Link from "next/link";

import { OrganizationProfile } from "@clerk/nextjs";

import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { Button } from "@/components/ui/button";
import { requireAdminAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const access = await requireAdminAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  return (
    <main className="framer-shell grid place-items-center">
      <section className="framer-frame grid w-full max-w-7xl gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <span className="framer-kicker">Team</span>
            <h1 className="mt-3 font-heading text-[clamp(32px,5vw,54px)] leading-[1.02] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
              Invite contributors to {access.site.name}
            </h1>
            <p className="mt-4 text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
              Admins can invite contributors and manage membership here.
              FramerLink keeps the role model intentionally small in this phase.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/settings">Back to settings</Link>
          </Button>
        </div>
        <div className="framer-subtle-panel overflow-hidden p-3">
          <OrganizationProfile routing="hash" />
        </div>
      </section>
    </main>
  );
}
