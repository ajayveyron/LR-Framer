/**
 * Shared utility functions used across multiple modules.
 *
 * - `looksLikeHtml` — lightweight regex test for HTML-like content.
 * - `mapWithConcurrency` — worker-pool style concurrent mapper.
 */

// ---------------------------------------------------------------------------
// HTML detection
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `value` appears to contain at least one HTML tag.
 */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

// ---------------------------------------------------------------------------
// Concurrent mapping
// ---------------------------------------------------------------------------

/**
 * Maps `items` through an async `mapItem` callback with at most `limit`
 * in-flight promises at any time (worker-pool pattern).
 *
 * Returns an array whose order matches the input `items` array.
 */
export async function mapWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  mapItem: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return [] as TResult[];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapItem(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}
