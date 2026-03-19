import { getDashboardOverview } from "@/lib/framer";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";
import { getDefaultColumns } from "@/lib/dashboard-columns";
import { isTransientFramerError } from "@/lib/framer-errors";
import { logError } from "@/lib/logger";
import { getSiteFramerRuntimeContext } from "@/lib/product-access";
import { resolveCurrentSiteCollection } from "@/lib/product-framer";

export async function loadDashboardScreen(requestedCollectionId?: string) {
  const { access, activeCollection, collections } =
    await resolveCurrentSiteCollection(requestedCollectionId);

  try {
    return await runWithFramerRuntimeContext(
      getSiteFramerRuntimeContext(access.site, {
        collectionId: activeCollection.id,
        collectionName: activeCollection.name,
      }),
      async () => {
        const overview = await getDashboardOverview();
        return {
          access,
          activeCollection,
          collections,
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
