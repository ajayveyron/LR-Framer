import { TeamPageClient } from "@/components/team-page-client";

export default function TeamPage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-7">
      <section className="grid w-full gap-10">
        <div className="grid gap-2">
          <h1 className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-fresco-title">Team</h1>
          <p className="max-w-2xl text-sm text-fresco-description">
            Manage members, invitations, and organization roles for this workspace.
          </p>
        </div>

        <TeamPageClient />
      </section>
    </main>
  );
}
