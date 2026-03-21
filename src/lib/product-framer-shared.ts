export const ACTIVE_COLLECTION_COOKIE = "lr-active-collection";

/**
 * Returns a headers object with the given collection ID.
 * Use this in client-side fetch calls to `/api/posts` so the server resolves
 * the correct collection regardless of cookie state.
 */
export function getCollectionHeader(collectionId?: string): Record<string, string> {
  if (collectionId) {
    return { "x-framer-collection-id": collectionId };
  }
  // Fallback: read from cookie
  if (typeof document === "undefined") return {};
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ACTIVE_COLLECTION_COOKIE}=`));
  if (!match) return {};
  const id = decodeURIComponent(match.slice(ACTIVE_COLLECTION_COOKIE.length + 1)).trim();
  return id ? { "x-framer-collection-id": id } : {};
}
