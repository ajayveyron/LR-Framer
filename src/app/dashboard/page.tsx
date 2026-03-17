import { DashboardTableView } from "@/components/dashboard-table-view";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { loadDashboardScreen } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const screen = await loadDashboardScreen();
  if (screen.kind === "config_error") {
    return <ProductConfigRequiredState issues={screen.issues} />;
  }

  if (screen.kind === "framer_unavailable") {
    return <FramerTemporaryUnavailableState />;
  }

  return (
    <DashboardTableView
      initialColumns={screen.initialColumns}
      metadata={screen.metadata}
      posts={screen.posts}
      role={screen.access.role}
      initialDrawerState={null}
    />
  );
}
