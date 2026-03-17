import { getDashboardOverview } from "@/lib/framer";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";
import { getDashboardAccess, getSiteFramerRuntimeContext } from "@/lib/product-access";
import { getDefaultColumns } from "@/lib/dashboard-columns";
import { isTransientFramerError } from "@/lib/framer-errors";
import { logError } from "@/lib/logger";

export async function loadDashboardScreen() {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return access;
  }

  try {
    return await runWithFramerRuntimeContext(
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
  } catch (error) {
    if (isTransientFramerError(error)) {
      logError("dashboard.load.retryableFramerError", error, {
        clerkOrganizationId: access.organizationId,
        clerkUserId: access.userId,
        framerProjectId: access.site.framerProjectId,
      });

      return {
        access,
        kind: "framer_unavailable" as const,
      };
    }

    throw error;
  }
}
