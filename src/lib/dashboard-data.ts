import {
  getCachedDashboardOverviewSnapshot,
  getDashboardOverview,
  getProjectInfo,
} from "@/lib/framer";
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

async function loadDashboardFallbackSnapshot(
  site: ProductSite,
  requestedCollectionId?: string,
) {
  const persistedSnapshot = parseDashboardSnapshot(site);
  const persistedCollection = pickDashboardSnapshotCollection(
    persistedSnapshot,
    requestedCollectionId,
    site.framerCollectionId,
  );
  if (persistedCollection) {
    return persistedCollection;
  }

  return runWithFramerRuntimeContext(
    getSiteFramerRuntimeContext(site, {
      collectionId: requestedCollectionId ?? site.framerCollectionId ?? undefined,
      collectionName:
        requestedCollectionId && requestedCollectionId !== site.framerCollectionId
          ? undefined
          : site.framerCollectionName ?? undefined,
    }),
    async () => {
      const cachedSnapshot = await getCachedDashboardOverviewSnapshot();
      if (!cachedSnapshot) {
        return null;
      }

      const collectionId =
        requestedCollectionId ?? site.framerCollectionId ?? "cached";
      const activeCollection =
        persistedSnapshot?.collections.find(
          (collection) => collection.id === collectionId,
        ) ?? {
          id: collectionId,
          name:
            (collectionId === site.framerCollectionId
              ? site.framerCollectionName
              : null) ??
            site.framerCollectionName ??
            "Cached collection",
        };

      return {
        activeCollection,
        cachedAt: cachedSnapshot.cachedAt,
        collections:
          persistedSnapshot?.collections.length
            ? persistedSnapshot.collections
            : [activeCollection],
        overview: cachedSnapshot.value,
        syncedAt: cachedSnapshot.cachedAt,
      };
    },
  );
}

export async function loadDashboardScreen(requestedCollectionId?: string) {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    throw new Error("Dashboard access is not configured.");
  }

  const persistedSnapshot = parseDashboardSnapshot(access.site);

  // Lightweight ping: if Framer is down, skip the heavy data fetch entirely
  // and fall through to the cached-snapshot / unavailable path.
  try {
    await runWithFramerRuntimeContext(
      getSiteFramerRuntimeContext(access.site, {
        collectionId: access.site.framerCollectionId ?? undefined,
        collectionName: access.site.framerCollectionName ?? undefined,
      }),
      () => getProjectInfo(),
    );
  } catch (pingError) {
    if (isTransientFramerError(pingError)) {
      logError("dashboard.load.retryableFramerError", pingError, {
        clerkOrganizationId: access.organizationId,
        clerkUserId: access.userId,
        framerProjectId: access.site.framerProjectId,
      });

      const fallbackSnapshot = await loadDashboardFallbackSnapshot(
        access.site,
        requestedCollectionId,
      );

      if (fallbackSnapshot) {
        return {
          access,
          activeCollection: fallbackSnapshot.activeCollection,
          collections: fallbackSnapshot.collections,
          framerStatus: {
            cachedAt: new Date(fallbackSnapshot.cachedAt).toISOString(),
            state: "stale" as const,
          },
          initialColumns: getDefaultColumns(fallbackSnapshot.overview.metadata),
          kind: "ready" as const,
          metadata: fallbackSnapshot.overview.metadata,
          posts: fallbackSnapshot.overview.posts,
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

    throw pingError;
  }

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

        // Fire-and-forget: don't block the page render waiting for snapshot persistence
        fetchProductMutation(anyApi.product.saveFramerDashboardSnapshot, {
          clerkOrganizationId: access.organizationId,
          snapshotJson: serializeDashboardSnapshot(nextSnapshot),
          syncedAt: nextSnapshot.syncedAt,
        }).catch((error) => {
          logError("dashboard.snapshot.save_failed", error, {
            clerkOrganizationId: access.organizationId,
            collectionId: activeCollection.id,
            postCount: overview.posts.length,
          });
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

      const fallbackSnapshot = await loadDashboardFallbackSnapshot(
        access.site,
        requestedCollectionId,
      );

      if (fallbackSnapshot) {
        return {
          access,
          activeCollection: fallbackSnapshot.activeCollection,
          collections: fallbackSnapshot.collections,
          framerStatus: {
            cachedAt: new Date(fallbackSnapshot.cachedAt).toISOString(),
            state: "stale" as const,
          },
          initialColumns: getDefaultColumns(fallbackSnapshot.overview.metadata),
          kind: "ready" as const,
          metadata: fallbackSnapshot.overview.metadata,
          posts: fallbackSnapshot.overview.posts,
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
