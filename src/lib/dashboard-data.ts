import { getDashboardOverview, getProjectInfo } from "@/lib/framer";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";
import { getDefaultColumns } from "@/lib/dashboard-columns";
import {
  parseDashboardSnapshot,
  pickDashboardSnapshotCollection,
  serializeDashboardSnapshot,
} from "@/lib/dashboard-snapshot";
import { isTransientFramerError } from "@/lib/framer-errors";
import { fetchProductMutation } from "@/lib/convex";
import { logError } from "@/lib/logger";
import {
  getDashboardAccess,
  getSiteFramerRuntimeContext,
} from "@/lib/product-access";
import { resolveCurrentSiteCollection } from "@/lib/product-framer";
import type { ProductSite } from "@/lib/product-types";
import { anyApi } from "convex/server";

export async function loadDashboardFramerStatus(site: ProductSite) {
  const persistedSnapshot = parseDashboardSnapshot(site);
  const persistedCollection = pickDashboardSnapshotCollection(
    persistedSnapshot,
    undefined,
    site.framerCollectionId,
  );

  return runWithFramerRuntimeContext(
    getSiteFramerRuntimeContext(site, {
      collectionId: site.framerCollectionId ?? undefined,
      collectionName: site.framerCollectionName ?? undefined,
    }),
    async () => {
      try {
        await getProjectInfo();

        return {
          cachedAt: null,
          state: "available" as const,
        };
      } catch (error) {
        if (!isTransientFramerError(error)) {
          throw error;
        }

        if (persistedCollection) {
          return {
            cachedAt: new Date(persistedCollection.cachedAt).toISOString(),
            state: "stale" as const,
          };
        }

        return {
          cachedAt: null,
          state: "unavailable" as const,
        };
      }
    },
  );
}

export async function loadDashboardScreen(requestedCollectionId?: string) {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    throw new Error("Dashboard access is not configured.");
  }

  const persistedSnapshot = parseDashboardSnapshot(access.site);
  const persistedCollection = pickDashboardSnapshotCollection(
    persistedSnapshot,
    requestedCollectionId,
    access.site.framerCollectionId,
  );

  try {
    const { activeCollection, collections } = await resolveCurrentSiteCollection(
      requestedCollectionId,
    );

    return await runWithFramerRuntimeContext(
      getSiteFramerRuntimeContext(access.site, {
        collectionId: activeCollection.id,
        collectionName: activeCollection.name,
      }),
      async () => {
        const overview = await getDashboardOverview();
        const nextSnapshot = {
          collections,
          snapshotsByCollectionId: {
            ...(persistedSnapshot?.snapshotsByCollectionId ?? {}),
            [activeCollection.id]: {
              cachedAt: Date.now(),
              collectionId: activeCollection.id,
              collectionName: activeCollection.name,
              metadata: overview.metadata,
              posts: overview.posts,
            },
          },
          syncedAt: Date.now(),
        };

        void fetchProductMutation(anyApi.product.saveFramerDashboardSnapshot, {
          clerkOrganizationId: access.organizationId,
          snapshotJson: serializeDashboardSnapshot(nextSnapshot),
          syncedAt: nextSnapshot.syncedAt,
        });

        return {
          access,
          activeCollection,
          collections,
          framerStatus: {
            cachedAt: null,
            state: "available" as const,
          },
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

      if (persistedCollection) {
        return {
          access,
          activeCollection: persistedCollection.activeCollection,
          collections: persistedCollection.collections,
          framerStatus: {
            cachedAt: new Date(persistedCollection.cachedAt).toISOString(),
            state: "stale" as const,
          },
          initialColumns: getDefaultColumns(persistedCollection.overview.metadata),
          kind: "ready" as const,
          metadata: persistedCollection.overview.metadata,
          posts: persistedCollection.overview.posts,
        };
      }

      return {
        access,
        activeCollection: {
          id: access.site.framerCollectionId ?? "unavailable",
          name: access.site.framerCollectionName ?? "Unavailable",
        },
        collections: [],
        framerStatus: {
          cachedAt: null,
          state: "unavailable" as const,
        },
        kind: "framer_unavailable" as const,
      };
    }

    throw error;
  }
}
