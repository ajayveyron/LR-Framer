import { DashboardTableView } from "@/components/dashboard-table-view";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
import { loadDashboardScreen } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const { collectionId } = await searchParams;
  const screen = await loadDashboardScreen(collectionId);
  if (screen.kind === "framer_unavailable") {
    return <FramerTemporaryUnavailableState />;
  }

  return (
    <DashboardTableView
      activeCollectionId={screen.activeCollection.id}
      collections={screen.collections}
      initialColumns={screen.initialColumns}
      metadata={screen.metadata}
      posts={screen.posts}
      role={screen.access.role}
      initialDrawerState={null}
    />
  );
}
