import "server-only";

import { gunzipSync, gzipSync } from "node:zlib";

import type {
  BlogCollectionMetadata,
  BlogPostRecord,
} from "@/lib/cms-types";
import type {
  FramerCollectionOption,
  ProductSite,
} from "@/lib/product-types";

export type DashboardSnapshotCollection = {
  cachedAt: number;
  collectionId: string;
  collectionName: string;
  metadata: BlogCollectionMetadata;
  posts: BlogPostRecord[];
};

export type DashboardSnapshot = {
  collections: FramerCollectionOption[];
  snapshotsByCollectionId: Record<string, DashboardSnapshotCollection>;
  syncedAt: number;
};

const DASHBOARD_SNAPSHOT_MAX_POSTS_PER_COLLECTION = 20;

export function parseDashboardSnapshot(site: ProductSite) {
  const raw = site.framerDashboardSnapshotJson;
  if (!raw) {
    return null;
  }

  try {
    const decoded = gunzipSync(Buffer.from(raw, "base64")).toString("utf-8");
    const parsed = JSON.parse(decoded) as DashboardSnapshot;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.snapshotsByCollectionId ||
      !parsed.collections ||
      !Array.isArray(parsed.collections)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function serializeDashboardSnapshot(snapshot: DashboardSnapshot) {
  const snapshotForStorage: DashboardSnapshot = {
    ...snapshot,
    snapshotsByCollectionId: Object.fromEntries(
      Object.entries(snapshot.snapshotsByCollectionId).map(
        ([collectionId, snapshotCollection]) => [
          collectionId,
          {
            ...snapshotCollection,
            posts: snapshotCollection.posts.slice(
              0,
              DASHBOARD_SNAPSHOT_MAX_POSTS_PER_COLLECTION,
            ),
          },
        ],
      ),
    ),
  };

  return gzipSync(JSON.stringify(snapshotForStorage)).toString("base64");
}

export function pickDashboardSnapshotCollection(
  snapshot: DashboardSnapshot | null,
  requestedCollectionId?: string,
  defaultCollectionId?: string | null,
) {
  if (!snapshot) {
    return null;
  }

  const preferredIds = [
    requestedCollectionId,
    defaultCollectionId ?? undefined,
    ...snapshot.collections.map((collection) => collection.id),
    ...Object.keys(snapshot.snapshotsByCollectionId),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const collectionId of preferredIds) {
    const snapshotCollection = snapshot.snapshotsByCollectionId[collectionId];
    if (!snapshotCollection) {
      continue;
    }

    const activeCollection =
      snapshot.collections.find((collection) => collection.id === collectionId) ??
      {
        id: snapshotCollection.collectionId,
        name: snapshotCollection.collectionName,
      };

    return {
      activeCollection,
      cachedAt: snapshotCollection.cachedAt,
      collections:
        snapshot.collections.length > 0
          ? snapshot.collections
          : [activeCollection],
      overview: {
        metadata: snapshotCollection.metadata,
        posts: snapshotCollection.posts,
      },
      syncedAt: snapshot.syncedAt,
    };
  }

  return null;
}
