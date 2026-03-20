import { SettingsPanel } from "@/components/settings-panel";
import { SettingsSessionPanel } from "@/components/settings-session-panel";

export default function SettingsPage() {
  return (
    <main className="dashboard-page-shell">
      <section className="grid w-full gap-10">
        <div className="grid gap-2">
          <h1 className="settings-heading">Settings</h1>
          <p className="max-w-2xl text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
            Configure the Framer workspace and default collection for this team.
          </p>
        </div>

        <SettingsPanel />
        <SettingsSessionPanel />
      </section>
    </main>
  );
}
