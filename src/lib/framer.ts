import "server-only";

import type {
  BlogCollectionMetadata,
  BridgeRemovalInput,
  BridgeSyncInput,
  BridgeSyncResponse,
  UpsertBlogPostInput,
} from "@/lib/cms-types";
import { getServerEnv } from "@/lib/env";
import {
  createBlogPost as createBlogPostCore,
  getBlogMetadata as getBlogMetadataCore,
  getBlogPostById as getBlogPostByIdCore,
  getDashboardOverview as getDashboardOverviewCore,
  getEditorBootstrap as getEditorBootstrapCore,
  listBlogPosts as listBlogPostsCore,
  removeBridgePosts as removeBridgePostsCore,
  syncBridgePosts as syncBridgePostsCore,
  updateBlogPost as updateBlogPostCore,
} from "@/lib/framer-core";

const METADATA_CACHE_TTL_MS = 30_000;

let cachedMetadata:
  | {
      cacheKey: string;
      expiresAt: number;
      value: BlogCollectionMetadata;
    }
  | null = null;

function getMetadataCacheKey() {
  const env = getServerEnv();
  return `${env.FRAMER_PROJECT_URL}::${env.FRAMER_COLLECTION_NAME}`;
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
