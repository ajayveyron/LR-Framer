import { DashboardTableView } from "@/components/dashboard-table-view";
import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { loadDashboardScreen } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const screen = await loadDashboardScreen();
  if (screen.kind === "config_error") {
    return <ProductConfigRequiredState issues={screen.issues} />;
  }

  return (
    <DashboardTableView
      initialColumns={screen.initialColumns}
      initialDrawerState={{ mode: "create" }}
      metadata={screen.metadata}
      posts={screen.posts}
      role={screen.access.role}
    />
  );
}
