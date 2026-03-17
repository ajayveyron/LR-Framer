import { fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionArgs, FunctionReference } from "convex/server";

import { getProductEnv } from "@/lib/product-env";

function getConvexOptions() {
  return {
    skipConvexDeploymentUrlCheck: true,
    url: getProductEnv().NEXT_PUBLIC_CONVEX_URL,
  } as const;
}

export function fetchProductQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
) {
  return fetchQuery(query, args, getConvexOptions());
}

export function fetchProductMutation<
  Mutation extends FunctionReference<"mutation">,
>(mutation: Mutation, args: FunctionArgs<Mutation>) {
  return fetchMutation(mutation, args, getConvexOptions());
}
