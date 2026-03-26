import "server-only";

import { anyApi } from "convex/server";

import { fetchProductQuery } from "@/lib/convex";
import type { BlogPostRecord, DashboardFieldValue } from "@/lib/cms-types";
import { logError } from "@/lib/logger";

interface ConvexStagedItem {
  _id: string;
  clerkOrganizationId: string;
  collectionId: string;
  slug: string;
  draft: boolean;
  fieldDataJson: string;
  createdByUserId: string;
  source: "ai" | "manual";
  createdAt: number;
  updatedAt: number;
}

/** Convert a Convex staged item into a BlogPostRecord with staged=true */
function toStagedPost(item: ConvexStagedItem): BlogPostRecord {
  let fieldValues: Record<string, DashboardFieldValue> = {};
  try {
    fieldValues = JSON.parse(item.fieldDataJson);
  } catch {
    // Corrupted JSON — use empty
  }

  // Derive title from field values (look for common title-like keys)
  let title = item.slug;
  for (const [, value] of Object.entries(fieldValues)) {
    if (typeof value === "string" && value.length > 0 && value.length < 200) {
      title = value;
      break; // First string field is likely the title
    }
  }

  return {
    id: `staged:${item._id}`,
    slug: item.slug,
    draft: item.draft,
    title,
    date: null,
    createdAt: new Date(item.createdAt).toISOString(),
    lastUpdated: new Date(item.updatedAt).toISOString(),
    lastUpdatedBy: null,
    fieldValues,
    staged: true,
    stagedId: item._id,
  };
}

/** Load staged items for an org+collection and convert to BlogPostRecord[] */
export async function loadStagedItems(
  organizationId: string,
  collectionId: string,
): Promise<BlogPostRecord[]> {
  try {
    const items = (await fetchProductQuery(
      anyApi.stagedItems.listByCollection,
      {
        clerkOrganizationId: organizationId,
        collectionId,
      },
    )) as ConvexStagedItem[];

    return items.map(toStagedPost);
  } catch (error) {
    // Staged items are non-critical — don't break the dashboard
    logError("staged_items.load.failed", error, {
      organizationId,
      collectionId,
    });
    return [];
  }
}
