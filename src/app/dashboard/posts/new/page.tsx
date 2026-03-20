import { Suspense } from "react";

import { DashboardTableView } from "@/components/dashboard-table-view";
import { DashboardTableSkeleton } from "@/components/dashboard-table-skeleton";
import { FramerStatusBanner } from "@/components/framer-status-banner";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
import { loadDashboardScreen } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

async function NewPostContent() {
  const screen = await loadDashboardScreen();
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
        initialDrawerState={{ mode: "create" }}
        metadata={screen.metadata}
        posts={screen.posts}
        role={screen.access.role}
      />
    </>
  );
}

export default async function NewPostPage() {
  return (
    <Suspense fallback={<DashboardTableSkeleton />}>
      <NewPostContent />
    </Suspense>
  );
}
