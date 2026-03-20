import { LoadingLink } from "@/components/loading-link";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/settings", label: "Workspace settings" },
  { href: "/dashboard/team", label: "Team" },
];

export function SettingsNav({ currentPath }: { currentPath: string }) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.08)] pb-4"
    >
      {tabs.map((tab) => {
        const active = currentPath === tab.href;

        return (
          <LoadingLink
            className={cn(
              "settings-label inline-flex h-8 items-center rounded-lg border-none px-3 transition-colors",
              active
                ? "bg-[#2B2B2B] text-[color:var(--framer-fresco-panelTitle-color)]"
                : "bg-transparent text-[color:var(--framer-fresco-panelSubtitle-color)] hover:bg-[#2B2B2B] hover:text-[color:var(--framer-fresco-panelTitle-color)]",
            )}
            href={tab.href}
            key={tab.href}
            pendingClassName="opacity-80"
          >
            {tab.label}
          </LoadingLink>
        );
      })}
    </nav>
  );
}
