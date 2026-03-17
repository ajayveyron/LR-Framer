import Link from "next/link";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/settings", label: "Workspace settings" },
  { href: "/dashboard/settings/team", label: "Team" },
];

export function SettingsNav({ currentPath }: { currentPath: string }) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-wrap items-center gap-2 border-b border-[var(--framer-fresco-panelDivider-color)] pb-4"
    >
      {tabs.map((tab) => {
        const active = currentPath === tab.href;

        return (
          <Link
            className={cn(
              "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
              active
                ? "border-[var(--framer-fresco-inputBorderActive-color)] bg-[var(--framer-app-surface-muted-color)] text-[color:var(--framer-fresco-panelTitle-color)]"
                : "border-[var(--framer-fresco-panelDivider-color)] text-[color:var(--framer-fresco-panelSubtitle-color)] hover:bg-[var(--framer-app-surface-muted-color)] hover:text-[color:var(--framer-fresco-panelTitle-color)]",
            )}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
