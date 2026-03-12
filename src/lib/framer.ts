import "server-only";

import { spawn } from "node:child_process";
import type {
  BlogCollectionMetadata,
  BridgeRemovalInput,
  BridgeSyncInput,
  BridgeSyncResponse,
  BlogPostRecord,
  BlogPostSummary,
  UpsertBlogPostInput,
} from "@/lib/cms-types";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

type FramerRpcAction =
  | "getBlogMetadata"
  | "getDashboardOverview"
  | "listBlogPosts"
  | "getBlogPostById"
  | "getEditorBootstrap"
  | "createBlogPost"
  | "updateBlogPost"
  | "syncBridgePosts"
  | "removeBridgePosts";

type FramerRpcPayloads = {
  getBlogMetadata: undefined;
  getDashboardOverview: { limit?: number } | undefined;
  listBlogPosts: undefined;
  getBlogPostById: { id: string };
  getEditorBootstrap: { id?: string };
  createBlogPost: { input: UpsertBlogPostInput; actor: string };
  updateBlogPost: { id: string; input: UpsertBlogPostInput; actor: string };
  syncBridgePosts: { inputs: BridgeSyncInput[]; actor: string };
  removeBridgePosts: { inputs: BridgeRemovalInput[]; actor: string };
};

type FramerRpcResultMap = {
  getBlogMetadata: BlogCollectionMetadata;
  getDashboardOverview: {
    metadata: BlogCollectionMetadata;
    posts: BlogPostRecord[];
  };
  listBlogPosts: BlogPostSummary[];
  getBlogPostById: BlogPostRecord;
  getEditorBootstrap: {
    metadata: BlogCollectionMetadata;
    post: BlogPostRecord | null;
  };
  createBlogPost: {
    post: BlogPostRecord;
    publish?: {
      deploymentId: string;
      hostnames: string[];
      createdAt: string;
    };
  };
  updateBlogPost: {
    post: BlogPostRecord;
    publish?: {
      deploymentId: string;
      hostnames: string[];
      createdAt: string;
    };
  };
  syncBridgePosts: BridgeSyncResponse;
  removeBridgePosts: BridgeSyncResponse;
};

type FramerRpcSuccess<T> = {
  ok: true;
  result: T;
};

type FramerRpcFailure = {
  ok: false;
  error: {
    name?: string;
    message?: string;
    status?: number;
    code?: string;
  };
};

const METADATA_CACHE_TTL_MS = 30_000;

let cachedMetadata:
  | {
      cacheKey: string;
      expiresAt: number;
      value: BlogCollectionMetadata;
    }
  | null = null;

function getScriptPath() {
  return `${process.cwd()}/scripts/framer-rpc.mjs`;
}

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

function getChildEnv() {
  const env = getServerEnv();
  const passthroughKeys = [
    "HOME",
    "LANG",
    "LC_ALL",
    "LOGNAME",
    "PATH",
    "SHELL",
    "SSH_AUTH_SOCK",
    "TEMP",
    "TERM",
    "TMP",
    "TMPDIR",
    "USER",
    "__CF_USER_TEXT_ENCODING",
    "XPC_FLAGS",
    "XPC_SERVICE_NAME",
  ] as const;
  const childEnv = Object.fromEntries(
    passthroughKeys
      .map((key) => [key, process.env[key]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return {
    ...process.env,
    ...childEnv,
    FRAMER_PROJECT_URL: env.FRAMER_PROJECT_URL,
    FRAMER_API_KEY: env.FRAMER_API_KEY,
    FRAMER_COLLECTION_NAME: env.FRAMER_COLLECTION_NAME,
  } satisfies NodeJS.ProcessEnv;
}

function normalizeRpcError(payload: FramerRpcFailure["error"], stderr: string) {
  if (payload.name === "AppError" && payload.status) {
    return new AppError(payload.message ?? "Framer request failed.", payload.status);
  }

  const message = payload.message?.trim() || stderr.trim() || "Unexpected server error.";

  if (payload.code === "UNAUTHORIZED") {
    return new AppError(message, 401);
  }

  if (payload.code === "INVALID_REQUEST") {
    return new AppError(message, 400);
  }

  if (payload.code === "NODE_NOT_FOUND") {
    return new AppError(message, 404);
  }

  if (payload.code) {
    return new AppError(message, 502);
  }

  return new Error(message);
}

async function runFramerRpc<TAction extends FramerRpcAction>(
  action: TAction,
  payload: FramerRpcPayloads[TAction],
): Promise<FramerRpcResultMap[TAction]> {
  const requestBody = JSON.stringify({ action, payload });
  const { stdout, stderr } = await new Promise<{
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--no-warnings", "--experimental-strip-types", getScriptPath()],
      {
        cwd: process.cwd(),
        env: getChildEnv(),
      },
    );
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrChunks.push(chunk);
    });

    child.on("error", (error: Error) => {
      reject(error);
    });

    child.on("close", (code: number | null) => {
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        Object.assign(new Error(stderr.trim() || "Framer subprocess failed."), {
          stdout,
          stderr,
        }),
      );
    });

    child.stdin.end(requestBody);
  }).catch((error: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) => {
    const stderrOutput = error.stderr?.trim();
    if (stderrOutput) {
      try {
        const payload = JSON.parse(stderrOutput) as FramerRpcFailure;
        if (payload.ok === false) {
          throw normalizeRpcError(payload.error, stderrOutput);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError !== error) {
          throw parseError;
        }
      }
    }

    throw new Error(stderrOutput || error.message || "Framer subprocess failed.");
  });

  const response = JSON.parse(stdout) as
    | FramerRpcSuccess<FramerRpcResultMap[TAction]>
    | FramerRpcFailure;

  if (!response.ok) {
    throw normalizeRpcError(response.error, stderr);
  }

  return response.result;
}

export async function getBlogMetadata() {
  return readMetadataCache() ??
    writeMetadataCache(await runFramerRpc("getBlogMetadata", undefined));
}

export async function getDashboardOverview(limit?: number) {
  return runFramerRpc("getDashboardOverview", typeof limit === "number" ? { limit } : undefined);
}

export async function listBlogPosts() {
  return runFramerRpc("listBlogPosts", undefined);
}

export async function getBlogPostById(id: string) {
  return runFramerRpc("getBlogPostById", { id });
}

export async function getEditorBootstrap(id?: string) {
  return runFramerRpc("getEditorBootstrap", id ? { id } : {});
}

export async function createBlogPost(
  input: UpsertBlogPostInput,
  actor: string,
) {
  return runFramerRpc("createBlogPost", { input, actor });
}

export async function updateBlogPost(
  id: string,
  input: UpsertBlogPostInput,
  actor: string,
) {
  return runFramerRpc("updateBlogPost", { id, input, actor });
}

export async function syncBridgePosts(
  inputs: BridgeSyncInput[],
  actor: string,
): Promise<BridgeSyncResponse> {
  if (inputs.length === 0) {
    return { results: [] };
  }

  return runFramerRpc("syncBridgePosts", { inputs, actor });
}

export async function removeBridgePosts(
  inputs: BridgeRemovalInput[],
  actor: string,
): Promise<BridgeSyncResponse> {
  if (inputs.length === 0) {
    return { results: [] };
  }

  return runFramerRpc("removeBridgePosts", { inputs, actor });
}

export async function syncBridgePostsFromRaw<T>(
  rawInputs: T[],
  actor: string,
  mapInput: (metadata: BlogCollectionMetadata, rawInput: T) => BridgeSyncInput,
): Promise<BridgeSyncResponse> {
  if (rawInputs.length === 0) {
    return { results: [] };
  }

  const metadata = await getBlogMetadata();
  const inputs = rawInputs.map((rawInput) => mapInput(metadata, rawInput));
  return syncBridgePosts(inputs, actor);
}
