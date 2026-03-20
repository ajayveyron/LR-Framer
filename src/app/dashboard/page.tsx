import { Suspense } from "react";

import { DashboardTableView } from "@/components/dashboard-table-view";
import { DashboardTableSkeleton } from "@/components/dashboard-table-skeleton";
import { FramerStatusBanner } from "@/components/framer-status-banner";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
import { loadDashboardScreen } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

async function DashboardContent({
  collectionId,
}: {
  collectionId?: string;
}) {
  const screen = await loadDashboardScreen(collectionId);
  if (screen.kind === "framer_unavailable") {
    return (
      <>
        <FramerStatusBanner cachedAt={null} state="unavailable" />
        <FramerTemporaryUnavailableState />
      </>
    );
  }

  return (
    <>
      {screen.framerStatus.state !== "available" ? (
        <FramerStatusBanner
          cachedAt={screen.framerStatus.cachedAt}
          state={screen.framerStatus.state}
        />
      ) : null}
      <DashboardTableView
        activeCollectionId={screen.activeCollection.id}
        collections={screen.collections}
        framerStatus={screen.framerStatus}
        metadata={screen.metadata}
        posts={screen.posts}
        role={screen.access.role}
        initialDrawerState={null}
      />
    </>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const { collectionId } = await searchParams;

  return (
    <Suspense fallback={<DashboardTableSkeleton />}>
      <DashboardContent collectionId={collectionId} />
    </Suspense>
  );
}
