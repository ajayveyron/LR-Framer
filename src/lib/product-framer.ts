import "server-only";

import { AppError } from "@/lib/errors";
import { getAllCollections } from "@/lib/framer";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";
import { getDashboardAccess, getSiteFramerRuntimeContext } from "@/lib/product-access";
import { ACTIVE_COLLECTION_COOKIE } from "@/lib/product-framer-shared";
import type { FramerCollectionOption } from "@/lib/product-types";

function getRequestedCollectionId(request?: Request) {
  if (!request) {
    return undefined;
  }

  const url = new URL(request.url);
  const fromSearch = url.searchParams.get("collectionId")?.trim();
  if (fromSearch) {
    return fromSearch;
  }

  const fromHeader = request.headers.get("x-framer-collection-id")?.trim();
  if (fromHeader) {
    return fromHeader;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }

  const match = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${ACTIVE_COLLECTION_COOKIE}=`));

  return match
    ? decodeURIComponent(match.slice(ACTIVE_COLLECTION_COOKIE.length + 1)).trim()
    : undefined;
}

export async function resolveCurrentSiteCollection(
  requestedCollectionId?: string,
) {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    throw new AppError(
      "Framer Bot is missing required product environment variables.",
      503,
      { fieldErrors: access.issues },
    );
  }

  const collections = await runWithFramerRuntimeContext(
    getSiteFramerRuntimeContext(access.site),
    async () =>
      (await getAllCollections())
        .filter((collection) => collection.managedBy === "user")
        .map((collection) => ({
          id: collection.id,
          name: collection.name,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
  );

  if (collections.length === 0) {
    throw new AppError(
      "This Framer project does not have any user-managed CMS collections available.",
      400,
    );
  }

  const activeCollection =
    collections.find((collection) => collection.id === requestedCollectionId) ??
    collections.find((collection) => collection.id === access.site.framerCollectionId) ??
    collections[0];

  return {
    access,
    activeCollection,
    collections,
  };
}

export async function runWithCurrentSiteFramerContext<T>(
  requestOrCallback: Request | (() => Promise<T>),
  maybeCallback?: () => Promise<T>,
) {
  const request =
    typeof requestOrCallback === "function" ? undefined : requestOrCallback;
  const callback =
    typeof requestOrCallback === "function" ? requestOrCallback : maybeCallback;

  if (!callback) {
    throw new Error("A Framer callback is required.");
  }

  const { access, activeCollection } = await resolveCurrentSiteCollection(
    getRequestedCollectionId(request),
  );

  return runWithFramerRuntimeContext(
    getSiteFramerRuntimeContext(access.site, {
      collectionId: activeCollection.id,
      collectionName: activeCollection.name,
    }),
    callback,
  );
}

export type ResolvedSiteCollectionState = {
  access: Awaited<ReturnType<typeof getDashboardAccess>> extends infer T
    ? T extends { kind: "ready" }
      ? T
      : never
    : never;
  activeCollection: FramerCollectionOption;
  collections: FramerCollectionOption[];
};
