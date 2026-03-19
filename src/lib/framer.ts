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
import { getFramerRuntimeContext } from "@/lib/framer-runtime";

const METADATA_CACHE_TTL_MS = 5 * 60_000;

let cachedMetadata:
  | {
      cacheKey: string;
      expiresAt: number;
      value: BlogCollectionMetadata;
    }
  | null = null;

function getMetadataCacheKey() {
  const runtimeContext = getFramerRuntimeContext();
  return `${runtimeContext.projectId}::${runtimeContext.collectionId ?? runtimeContext.collectionName ?? "__project__"}`;
}

function readMetadataCache() {
  if (
    cachedMetadata &&
    cachedMetadata.cacheKey === getMetadataCacheKey() &&
    cachedMetadata.expiresAt > Date.now()
  ) {
    return cachedMetadata.value;
  }

  cachedMetadata = null;
  return null;
}

function writeMetadataCache(value: BlogCollectionMetadata) {
  cachedMetadata = {
    cacheKey: getMetadataCacheKey(),
    expiresAt: Date.now() + METADATA_CACHE_TTL_MS,
    value,
  };

  return value;
}

export async function getBlogMetadata() {
  return readMetadataCache() ?? writeMetadataCache(await getBlogMetadataCore());
}

export async function getDashboardOverview(limit?: number) {
  return getDashboardOverviewCore(limit);
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
  return createBlogPostCore(input, actor);
}

export async function updateBlogPost(
  id: string,
  input: UpsertBlogPostInput,
  actor: string,
) {
  return updateBlogPostCore(id, input, actor);
}

export async function deleteBlogPost(id: string, actor: string) {
  return deleteBlogPostCore(id, actor);
}

export async function syncBridgePosts(
  inputs: BridgeSyncInput[],
  actor: string,
  publishRequested = false,
): Promise<BridgeSyncResponse> {
  if (inputs.length === 0) {
    return { results: [] };
  }

  return syncBridgePostsCore(inputs, actor, publishRequested);
}

export async function removeBridgePosts(
  inputs: BridgeRemovalInput[],
  actor: string,
): Promise<BridgeSyncResponse> {
  if (inputs.length === 0) {
    return { results: [] };
  }

  return removeBridgePostsCore(inputs, actor);
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
  return getAllCollectionsCore();
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
  return addCollectionItemsCore(collectionId, items);
}

export async function removeCollectionItems(
  collectionId: string,
  itemIds: string[],
) {
  return removeCollectionItemsCore(collectionId, itemIds);
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
  return setCollectionItemAttributesCore(collectionId, itemId, attributes);
}

export async function removeCollectionItem(
  collectionId: string,
  itemId: string,
) {
  return removeCollectionItemCore(collectionId, itemId);
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
  return addEnumCaseCore(collectionId, fieldId, name);
}

export async function setEnumCaseOrder(
  collectionId: string,
  fieldId: string,
  caseIds: string[],
) {
  return setEnumCaseOrderCore(collectionId, fieldId, caseIds);
}

export async function updateEnumCase(
  collectionId: string,
  fieldId: string,
  caseId: string,
  newName: string,
) {
  return updateEnumCaseCore(collectionId, fieldId, caseId, newName);
}

export async function removeEnumCase(
  collectionId: string,
  fieldId: string,
  caseId: string,
) {
  return removeEnumCaseCore(collectionId, fieldId, caseId);
}

export async function setCollectionAsActive(collectionId: string) {
  return setCollectionAsActiveCore(collectionId);
}
