import { Spinner } from "@/components/ui/spinner";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[280px] items-center justify-center">
      <div className="framer-subtle-panel flex min-w-[220px] items-center justify-center gap-3 px-6 py-5 text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
        <Spinner className="size-4" />
        <span>Loading dashboard...</span>
      </div>
    </div>
  );
}
