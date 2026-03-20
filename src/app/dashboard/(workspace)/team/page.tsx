import { TeamPageClient } from "@/components/team-page-client";

export default function TeamPage() {
  return (
    <main className="dashboard-page-shell">
      <section className="mx-auto grid w-full max-w-6xl gap-10">
        <div className="grid gap-2">
          <h1 className="settings-heading">Team</h1>
          <p className="max-w-2xl text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
            Manage members, invitations, and organization roles for this workspace.
          </p>
        </div>

        <TeamPageClient />
      </section>
    </main>
  );
}
