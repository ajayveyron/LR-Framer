import "server-only";

import type {
  BlogCollectionMetadata,
  BridgeRemovalInput,
  BridgeSyncInput,
  BridgeSyncResponse,
  UpsertBlogPostInput,
} from "@/lib/cms-types";
import {
  addCollectionItems as addCollectionItemsCore,
  addEnumCase as addEnumCaseCore,
  createBlogPost as createBlogPostCore,
  deleteBlogPost as deleteBlogPostCore,
  getAllCollections as getAllCollectionsCore,
  getBlogMetadata as getBlogMetadataCore,
  getBlogPostById as getBlogPostByIdCore,
  getCollectionById as getCollectionByIdCore,
  getCollectionFields as getCollectionFieldsCore,
  getCollectionItems as getCollectionItemsCore,
  getDashboardOverview as getDashboardOverviewCore,
  getEditorBootstrap as getEditorBootstrapCore,
  getEnumFieldCases as getEnumFieldCasesCore,
  getProjectInfo as getProjectInfoCore,
  getPublishInfo as getPublishInfoCore,
  listBlogPosts as listBlogPostsCore,
  publishSite as publishSiteCore,
  removeCollectionItem as removeCollectionItemCore,
  removeCollectionItems as removeCollectionItemsCore,
  removeBridgePosts as removeBridgePostsCore,
  removeEnumCase as removeEnumCaseCore,
  setCollectionAsActive as setCollectionAsActiveCore,
  setCollectionItemAttributes as setCollectionItemAttributesCore,
  setEnumCaseOrder as setEnumCaseOrderCore,
  syncBridgePosts as syncBridgePostsCore,
  updateBlogPost as updateBlogPostCore,
  updateEnumCase as updateEnumCaseCore,
} from "@/lib/framer-core";
import {
  readDashboardOverviewSnapshot,
  writeDashboardOverviewSnapshot,
} from "@/lib/framer-dashboard-snapshot";
import { logError } from "@/lib/logger";
import { getFramerRuntimeContext } from "@/lib/framer-runtime";

const METADATA_CACHE_TTL_MS = 5 * 60_000;
const COLLECTIONS_CACHE_TTL_MS = 5 * 60_000;
const DASHBOARD_OVERVIEW_CACHE_TTL_MS = 30_000;

type CacheEntry<T> = {
  cachedAt: number;
  expiresAt: number;
  value: T;
};

const metadataCache = new Map<string, CacheEntry<BlogCollectionMetadata>>();
const collectionsCache = new Map<string, CacheEntry<Awaited<ReturnType<typeof getAllCollectionsCore>>>>();
const dashboardOverviewCache = new Map<
  string,
  CacheEntry<Awaited<ReturnType<typeof getDashboardOverviewCore>>>
>();
type DashboardOverview = Awaited<ReturnType<typeof getDashboardOverviewCore>>;

function getProjectCacheKey() {
  const runtimeContext = getFramerRuntimeContext();
  return runtimeContext.projectId;
}

function getMetadataCacheKey() {
  const runtimeContext = getFramerRuntimeContext();
  return `${runtimeContext.projectId}::${runtimeContext.collectionId ?? runtimeContext.collectionName ?? "__project__"}`;
}

function getDashboardOverviewCacheKey(limit?: number) {
  return `${getMetadataCacheKey()}::overview::${limit ?? "all"}`;
}

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }

  return null;
}

function getCachedEntry<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  return cache.get(key) ?? null;
}

function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttlMs: number,
  value: T,
) {
  cache.set(key, {
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    value,
  });

  return value;
}

function writeMetadataCache(value: BlogCollectionMetadata) {
  return writeCache(
    metadataCache,
    getMetadataCacheKey(),
    METADATA_CACHE_TTL_MS,
    value,
  );
}

function invalidateProjectCaches(projectId: string) {
  collectionsCache.delete(projectId);

  for (const key of metadataCache.keys()) {
    if (key.startsWith(`${projectId}::`)) {
      metadataCache.delete(key);
    }
  }

  for (const key of dashboardOverviewCache.keys()) {
    if (key.startsWith(`${projectId}::`)) {
      dashboardOverviewCache.delete(key);
    }
  }
}

function invalidateCurrentProjectCaches() {
  invalidateProjectCaches(getProjectCacheKey());
}

export function clearFramerCaches() {
  metadataCache.clear();
  collectionsCache.clear();
  dashboardOverviewCache.clear();
}

export async function getBlogMetadata() {
  return (
    readCache(metadataCache, getMetadataCacheKey()) ??
    writeMetadataCache(await getBlogMetadataCore())
  );
}

export async function getDashboardOverview(limit?: number) {
  const cacheKey = getDashboardOverviewCacheKey(limit);
  const cached = readCache(dashboardOverviewCache, cacheKey);
  if (cached) {
    return cached;
  }

  const overview = await getDashboardOverviewCore(limit);
  writeCache(
    dashboardOverviewCache,
    cacheKey,
    DASHBOARD_OVERVIEW_CACHE_TTL_MS,
    overview,
  );
  await writeDashboardOverviewSnapshot<DashboardOverview>(cacheKey, {
    cachedAt: Date.now(),
    value: overview,
  });

  return overview;
}

export async function getCachedDashboardOverviewSnapshot(limit?: number) {
  const cacheKey = getDashboardOverviewCacheKey(limit);
  const entry = getCachedEntry(dashboardOverviewCache, cacheKey);
  if (!entry) {
    try {
      const persisted = await readDashboardOverviewSnapshot<DashboardOverview>(
        cacheKey,
      );
      if (!persisted) {
        return null;
      }

      writeCache(
        dashboardOverviewCache,
        cacheKey,
        DASHBOARD_OVERVIEW_CACHE_TTL_MS,
        persisted.value,
      );

      return persisted;
    } catch (error) {
      logError("framer.snapshot.read_failed", error, { cacheKey });
      return null;
    }
  }

  return {
    cachedAt: entry.cachedAt,
    value: entry.value,
  };
}

export async function listBlogPosts() {
  return listBlogPostsCore();
}

export async function getBlogPostById(id: string) {
  return getBlogPostByIdCore(id);
}

export async function getEditorBootstrap(id?: string) {
  return getEditorBootstrapCore(id);
}

export async function createBlogPost(
  input: UpsertBlogPostInput,
  actor: string,
) {
  const result = await createBlogPostCore(input, actor);
  invalidateCurrentProjectCaches();
  return result;
}

export async function updateBlogPost(
  id: string,
  input: UpsertBlogPostInput,
  actor: string,
) {
  const result = await updateBlogPostCore(id, input, actor);
  invalidateCurrentProjectCaches();
  return result;
}

export async function deleteBlogPost(id: string, actor: string) {
  const result = await deleteBlogPostCore(id, actor);
  invalidateCurrentProjectCaches();
  return result;
}

export async function syncBridgePosts(
  inputs: BridgeSyncInput[],
  actor: string,
  publishRequested = false,
): Promise<BridgeSyncResponse> {
  if (inputs.length === 0) {
    return { results: [] };
  }

  const result = await syncBridgePostsCore(inputs, actor, publishRequested);
  invalidateCurrentProjectCaches();
  return result;
}

export async function removeBridgePosts(
  inputs: BridgeRemovalInput[],
  actor: string,
): Promise<BridgeSyncResponse> {
  if (inputs.length === 0) {
    return { results: [] };
  }

  const result = await removeBridgePostsCore(inputs, actor);
  invalidateCurrentProjectCaches();
  return result;
}

export async function syncBridgePostsFromRaw<T>(
  rawInputs: T[],
  actor: string,
  mapInput: (metadata: BlogCollectionMetadata, rawInput: T) => BridgeSyncInput,
  publishRequested = false,
): Promise<BridgeSyncResponse> {
  if (rawInputs.length === 0) {
    return { results: [] };
  }

  const metadata = await getBlogMetadata();
  const inputs = rawInputs.map((rawInput) => mapInput(metadata, rawInput));
  return syncBridgePosts(inputs, actor, publishRequested);
}

// ---------------------------------------------------------------------------
// Generic Framer project operations
// ---------------------------------------------------------------------------

export async function getProjectInfo() {
  return getProjectInfoCore();
}

export async function getPublishInfo() {
  return getPublishInfoCore();
}

export async function publishSite() {
  return publishSiteCore();
}

export async function getAllCollections() {
  return (
    readCache(collectionsCache, getProjectCacheKey()) ??
    writeCache(
      collectionsCache,
      getProjectCacheKey(),
      COLLECTIONS_CACHE_TTL_MS,
      await getAllCollectionsCore(),
    )
  );
}

export async function getCollectionById(collectionId: string) {
  return getCollectionByIdCore(collectionId);
}

export async function getCollectionFields(collectionId: string) {
  return getCollectionFieldsCore(collectionId);
}

export async function getCollectionItems(collectionId: string) {
  return getCollectionItemsCore(collectionId);
}

export async function addCollectionItems(
  collectionId: string,
  items: Array<{
    id?: string;
    slug: string;
    draft?: boolean;
    fieldData?: Record<string, { type: string; value: unknown }>;
  }>,
) {
  const result = await addCollectionItemsCore(collectionId, items);
  invalidateCurrentProjectCaches();
  return result;
}

export async function removeCollectionItems(
  collectionId: string,
  itemIds: string[],
) {
  const result = await removeCollectionItemsCore(collectionId, itemIds);
  invalidateCurrentProjectCaches();
  return result;
}

export async function setCollectionItemAttributes(
  collectionId: string,
  itemId: string,
  attributes: {
    slug?: string;
    draft?: boolean;
    fieldData?: Record<string, { type: string; value: unknown }>;
  },
) {
  const result = await setCollectionItemAttributesCore(collectionId, itemId, attributes);
  invalidateCurrentProjectCaches();
  return result;
}

export async function removeCollectionItem(
  collectionId: string,
  itemId: string,
) {
  const result = await removeCollectionItemCore(collectionId, itemId);
  invalidateCurrentProjectCaches();
  return result;
}

export async function getEnumFieldCases(
  collectionId: string,
  fieldId: string,
) {
  return getEnumFieldCasesCore(collectionId, fieldId);
}

export async function addEnumCase(
  collectionId: string,
  fieldId: string,
  name: string,
) {
  const result = await addEnumCaseCore(collectionId, fieldId, name);
  invalidateCurrentProjectCaches();
  return result;
}

export async function setEnumCaseOrder(
  collectionId: string,
  fieldId: string,
  caseIds: string[],
) {
  const result = await setEnumCaseOrderCore(collectionId, fieldId, caseIds);
  invalidateCurrentProjectCaches();
  return result;
}

export async function updateEnumCase(
  collectionId: string,
  fieldId: string,
  caseId: string,
  newName: string,
) {
  const result = await updateEnumCaseCore(collectionId, fieldId, caseId, newName);
  invalidateCurrentProjectCaches();
  return result;
}

export async function removeEnumCase(
  collectionId: string,
  fieldId: string,
  caseId: string,
) {
  const result = await removeEnumCaseCore(collectionId, fieldId, caseId);
  invalidateCurrentProjectCaches();
  return result;
}

export async function setCollectionAsActive(collectionId: string) {
  const result = await setCollectionAsActiveCore(collectionId);
  invalidateCurrentProjectCaches();
  return result;
}
