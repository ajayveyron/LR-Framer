/**
 * Sandboxed bulk-script execution engine.
 *
 * Runs AI-authored JavaScript inside a `vm.runInNewContext` sandbox with a
 * restricted set of globals. The script gets a pre-authenticated Framer SDK
 * instance but NO access to Node.js APIs (require, fs, process, fetch, etc.).
 */

import vm from "node:vm";

import { logEvent, logError } from "@/lib/logger";
import { mapWithConcurrency } from "@/lib/shared-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StagingAPI {
  /** List all staged items for a collection. Returns array of { stagedId, slug, draft, fieldData, createdAt }. */
  list: (collectionId: string) => Promise<unknown[]>;
  /** Create a new staged item. Returns the staged item ID. */
  create: (params: {
    collectionId: string;
    slug: string;
    draft: boolean;
    fieldData: Record<string, unknown>;
  }) => Promise<string>;
  /** Remove a staged item by ID. */
  remove: (stagedId: string) => Promise<void>;
}

export interface BulkScriptContext {
  /** Authenticated Framer SDK instance (only valid within withFramerProject callback). */
  framer: unknown;
  /** Pre-fetched collection object, if the AI specified a collectionId. */
  collection?: unknown;
  /** Pre-fetched field definitions for the collection (if collectionId provided). */
  fields?: unknown[];
  /** Pre-fetched list of all collections. */
  collections?: unknown[];
  /** Staging API for managing staged items (create/list/remove). Only available when staging context exists. */
  staging?: StagingAPI;
}

export interface BulkScriptResult {
  success: boolean;
  logs: string[];
  result?: unknown;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCRIPT_TIMEOUT_MS = 120_000; // 2 minutes
const MAX_LOG_ENTRIES = 200;
const MAX_LOG_BYTES = 50_000;
const MAX_RESULT_BYTES = 100_000;

// ---------------------------------------------------------------------------
// Console capture
// ---------------------------------------------------------------------------

function createConsoleCapture() {
  const logs: string[] = [];
  let totalBytes = 0;

  function push(prefix: string, args: unknown[]) {
    if (logs.length >= MAX_LOG_ENTRIES || totalBytes >= MAX_LOG_BYTES) return;

    const line = `${prefix} ${args
      .map((a) => {
        try {
          return typeof a === "string" ? a : JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ")}`;

    const bytes = Buffer.byteLength(line, "utf-8");
    if (totalBytes + bytes > MAX_LOG_BYTES) return;

    logs.push(line);
    totalBytes += bytes;
  }

  const proxy = {
    log: (...args: unknown[]) => push("[LOG]", args),
    warn: (...args: unknown[]) => push("[WARN]", args),
    error: (...args: unknown[]) => push("[ERR]", args),
    info: (...args: unknown[]) => push("[LOG]", args),
    debug: (...args: unknown[]) => push("[LOG]", args),
  };

  return { proxy, logs };
}

// ---------------------------------------------------------------------------
// Built-in helpers exposed to scripts
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function batch<T, R>(
  items: T[],
  size: number,
  fn: (chunk: T[], index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    results.push(await fn(chunk, Math.floor(i / size)));
  }
  return results;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Sandbox globals builder
// ---------------------------------------------------------------------------

function buildSandboxGlobals(
  ctx: BulkScriptContext,
  consoleProxy: ReturnType<typeof createConsoleCapture>["proxy"],
) {
  return {
    // Framer SDK
    framer: ctx.framer,
    collection: ctx.collection ?? undefined,
    fields: ctx.fields ?? undefined,
    collections: ctx.collections ?? undefined,

    // Staging API (for managing staged items in Convex)
    staging: ctx.staging ?? undefined,

    // Captured console
    console: consoleProxy,

    // Helpers
    sleep,
    batch,
    slugify,
    mapWithConcurrency,

    // Safe built-ins
    Promise,
    JSON,
    Array,
    Object,
    Map,
    Set,
    WeakMap,
    WeakSet,
    WeakRef,
    Date,
    Math,
    Number,
    String,
    Boolean,
    RegExp,
    Symbol,
    BigInt,
    Proxy,
    Reflect,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    AggregateError,
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,

    // URL handling
    URL,
    URLSearchParams,

    // Encoding / decoding
    atob,
    btoa,
    TextEncoder,
    TextDecoder,

    // Typed arrays & binary
    ArrayBuffer,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array,
    DataView,

    // Cloning & formatting
    structuredClone,
    Intl,

    // Async utilities
    queueMicrotask,
    AbortController,
    AbortSignal,

    // ID generation (safe subset of crypto)
    crypto: { randomUUID: () => crypto.randomUUID() },

    // Timers (needed for batching/delays)
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

function formatScriptError(error: unknown): string {
  if (error instanceof SyntaxError) {
    return `SyntaxError: ${error.message}`;
  }
  if (error instanceof Error) {
    // Extract useful info from vm errors
    const lines = error.stack?.split("\n") ?? [];
    const relevantLines = lines.filter(
      (line) =>
        line.includes("evalmachine") ||
        line.includes("Script") ||
        !line.includes("node:"),
    );
    if (relevantLines.length > 0) {
      return `${error.constructor.name}: ${error.message}\n${relevantLines.slice(0, 3).join("\n")}`;
    }
    return `${error.constructor.name}: ${error.message}`;
  }
  return String(error);
}

// ---------------------------------------------------------------------------
// Result serializer
// ---------------------------------------------------------------------------

function serializeResult(value: unknown): unknown {
  if (value === undefined || value === null) return value;

  try {
    const json = JSON.stringify(value);
    if (json.length > MAX_RESULT_BYTES) {
      return `[Result truncated: ${json.length} bytes. First ${MAX_RESULT_BYTES} chars]: ${json.slice(0, MAX_RESULT_BYTES)}…`;
    }
    return JSON.parse(json); // Round-trip to strip non-serializable parts
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

export async function executeBulkScript(
  script: string,
  ctx: BulkScriptContext,
): Promise<BulkScriptResult> {
  const startMs = Date.now();
  const { proxy, logs } = createConsoleCapture();

  logEvent("info", "bulk_script.execute.start", {
    scriptLength: script.length,
    hasCollection: Boolean(ctx.collection),
  });

  try {
    // Wrap in async IIFE so top-level await works
    const wrappedScript = `(async () => {\n${script}\n})()`;

    // Compile the script
    const compiled = new vm.Script(wrappedScript, {
      filename: "bulk-script.js",
    });

    // Build sandboxed context
    const sandbox = buildSandboxGlobals(ctx, proxy);
    const vmContext = vm.createContext(sandbox, {
      name: "bulk-script-sandbox",
    });

    // Execute — returns a Promise from the async IIFE
    const resultPromise = compiled.runInContext(vmContext) as Promise<unknown>;

    // Race against timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Script timed out after ${SCRIPT_TIMEOUT_MS / 1000} seconds`));
      }, SCRIPT_TIMEOUT_MS);
      // Don't keep the process alive just for the timeout
      if (typeof timer === "object" && "unref" in timer) {
        timer.unref();
      }
    });

    const rawResult = await Promise.race([resultPromise, timeoutPromise]);
    const result = serializeResult(rawResult);
    const durationMs = Date.now() - startMs;

    logEvent("info", "bulk_script.execute.success", {
      durationMs,
      logCount: logs.length,
    });

    return { success: true, logs, result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startMs;
    const errorMessage = formatScriptError(error);

    logError("bulk_script.execute.failed", error, { durationMs });

    return { success: false, logs, error: errorMessage, durationMs };
  }
}
