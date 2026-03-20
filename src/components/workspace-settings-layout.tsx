"use client";

import { useAuth } from "@clerk/nextjs";

import { useDashboardDisplayPathname } from "@/components/dashboard-navigation";
import { SettingsNav } from "@/components/settings-nav";

function getWorkspaceCopy(pathname: string) {
  if (pathname.startsWith("/dashboard/team")) {
    return {
      description:
        "Manage members, invitations, and organization roles for this workspace.",
      title: "Team",
    };
  }

  return {
    description:
      "Configure the Framer workspace and default collection for this team.",
    title: "Settings",
  };
}

export function WorkspaceSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = useDashboardDisplayPathname();
  const { isLoaded, orgRole } = useAuth();
  const copy = getWorkspaceCopy(pathname);
  const showTeamTab =
    orgRole === "org:admin" || (!isLoaded && pathname.startsWith("/dashboard/team"));

  return (
    <main className="dashboard-page-shell">
      <section className="mx-auto grid w-full max-w-6xl gap-10">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <h1 className="settings-heading">{copy.title}</h1>
            <p className="max-w-2xl text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
              {copy.description}
            </p>
          </div>
          <SettingsNav showTeamTab={showTeamTab} />
        </div>

        {children}
      </section>
    </main>
  );
}
