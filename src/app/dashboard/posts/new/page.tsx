import { Suspense } from "react";

import { DashboardTableView } from "@/components/dashboard-table-view";
import { DashboardTableSkeleton } from "@/components/dashboard-table-skeleton";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
import { loadDashboardScreen } from "@/lib/dashboard-data";
import { loadStagedItems } from "@/lib/staged-items";

export const dynamic = "force-dynamic";

async function NewPostContent() {
  const screen = await loadDashboardScreen();
  if (screen.kind === "framer_unavailable") {
    return <FramerTemporaryUnavailableState />;
  }

  const stagedItems = await loadStagedItems(
    screen.access.organizationId,
    screen.activeCollection.id,
  );

  return (
    <DashboardTableView
      activeCollectionId={screen.activeCollection.id}
      collections={screen.collections}
      framerStatus={screen.framerStatus}
      initialDrawerState={{ mode: "create" }}
      metadata={screen.metadata}
      posts={[...stagedItems, ...screen.posts]}
      role={screen.access.role}
    />
  );
}

export default async function NewPostPage() {
  return (
    <Suspense fallback={<DashboardTableSkeleton />}>
      <NewPostContent />
    </Suspense>
  );
}
