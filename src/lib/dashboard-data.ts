import { getDashboardOverview } from "@/lib/framer";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";
import { getDashboardAccess, getSiteFramerRuntimeContext } from "@/lib/product-access";
import { getDefaultColumns } from "@/lib/dashboard-columns";

export async function loadDashboardScreen() {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return access;
  }

  return runWithFramerRuntimeContext(
    getSiteFramerRuntimeContext(access.site),
    async () => {
      const overview = await getDashboardOverview();
      return {
        access,
        initialColumns: getDefaultColumns(overview.metadata),
        kind: "ready" as const,
        metadata: overview.metadata,
        posts: overview.posts,
      };
    },
  );
}
