import { Suspense } from "react";

import { DashboardTableView } from "@/components/dashboard-table-view";
import { DashboardTableSkeleton } from "@/components/dashboard-table-skeleton";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
import { loadDashboardScreen } from "@/lib/dashboard-data";
import { loadStagedItems } from "@/lib/staged-items";

export const dynamic = "force-dynamic";

function parseInitialDrawerState(params: {
  action?: string;
  id?: string;
}): { mode: "create" } | { mode: "edit"; postId: string } | null {
  if (params.action === "create") {
    return { mode: "create" };
  }
  if (params.action === "edit" && params.id) {
    return { mode: "edit", postId: params.id };
  }
  return null;
}

async function DashboardContent({
  collectionId,
  initialDrawerState,
}: {
  collectionId?: string;
  initialDrawerState: { mode: "create" } | { mode: "edit"; postId: string } | null;
}) {
  const screen = await loadDashboardScreen(collectionId);
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
      metadata={screen.metadata}
      posts={[...stagedItems, ...screen.posts]}
      role={screen.access.role}
      initialDrawerState={initialDrawerState}
    />
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string; action?: string; id?: string }>;
}) {
  const { collectionId, action, id } = await searchParams;
  const initialDrawerState = parseInitialDrawerState({ action, id });

  return (
    <Suspense fallback={<DashboardTableSkeleton />}>
      <DashboardContent collectionId={collectionId} initialDrawerState={initialDrawerState} />
    </Suspense>
  );
}
