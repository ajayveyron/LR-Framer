import { FramerStatusBanner } from "@/components/framer-status-banner";
import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { loadDashboardFramerStatus } from "@/lib/dashboard-data";
import { getDashboardAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  const framerStatus = await loadDashboardFramerStatus(access.site);

  return (
    <div className="grid h-dvh min-h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      {framerStatus.state !== "available" ? (
        <FramerStatusBanner
          cachedAt={framerStatus.cachedAt}
          state={framerStatus.state}
        />
      ) : null}
      <div className="relative min-h-0 md:grid md:grid-cols-[260px_minmax(0,1fr)] bg-dash-shell text-fresco-text font-sans overflow-hidden overscroll-none" id="dashboard-shell">
        <DashboardSidebar role={access.role} />
        <main className="min-w-0 h-full overflow-y-auto overscroll-none">{children}</main>
      </div>
    </div>
  );
}
