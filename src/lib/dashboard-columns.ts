import type { BlogCollectionMetadata } from "@/lib/cms-types";

export function getDefaultColumns(metadata: BlogCollectionMetadata) {
  const titleFieldId = metadata.logicalFields.title;

  return [
    "title",
    "slug",
    "status",
    "lastUpdated",
    ...metadata.fields
      .filter((field) => field.id !== titleFieldId)
      .map((field) => `field:${field.id}`),
  ];
}
