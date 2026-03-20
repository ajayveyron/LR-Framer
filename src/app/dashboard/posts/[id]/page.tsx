import { DashboardTableView } from "@/components/dashboard-table-view";
import { FramerTemporaryUnavailableState } from "@/components/framer-temporary-unavailable-state";
import { loadDashboardScreen } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const screen = await loadDashboardScreen();
  if (screen.kind === "framer_unavailable") {
    return <FramerTemporaryUnavailableState />;
  }

  return (
    <DashboardTableView
      activeCollectionId={screen.activeCollection.id}
      collections={screen.collections}
      framerStatus={screen.framerStatus}
      initialDrawerState={{ mode: "edit", postId: id }}
      metadata={screen.metadata}
      posts={screen.posts}
      role={screen.access.role}
    />
  );
}
