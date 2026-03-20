import { FramerStatusBanner } from "@/components/framer-status-banner";
import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import {
  DashboardMainTransition,
  DashboardNavigationProvider,
} from "@/components/dashboard-navigation";
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
    <DashboardNavigationProvider>
      <div className="dashboard-shell overscroll-none">
        {framerStatus.state !== "available" ? (
          <FramerStatusBanner
            cachedAt={framerStatus.cachedAt}
            state={framerStatus.state}
          />
        ) : null}
        <DashboardSidebar
          role={access.role}
          siteName={access.site.name}
        />
        <main className="dashboard-main">
          <DashboardMainTransition>{children}</DashboardMainTransition>
        </main>
      </div>
    </DashboardNavigationProvider>
  );
}
