/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentMemory from "../agentMemory.js";
import type * as billing from "../billing.js";
import type * as chat from "../chat.js";
import type * as cleanup from "../cleanup.js";
import type * as cleanupQueries from "../cleanupQueries.js";
import type * as crons from "../crons.js";
import type * as product from "../product.js";
import type * as stagedItems from "../stagedItems.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentMemory: typeof agentMemory;
  billing: typeof billing;
  chat: typeof chat;
  cleanup: typeof cleanup;
  cleanupQueries: typeof cleanupQueries;
  crons: typeof crons;
  product: typeof product;
  stagedItems: typeof stagedItems;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
