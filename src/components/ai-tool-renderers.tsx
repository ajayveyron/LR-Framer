"use client";

import { Badge } from "@/components/ui/badge";
import { Database, Rows, Lock, Tag, ListBullets } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Shared types for Framer tool outputs
// ---------------------------------------------------------------------------

interface CollectionInfo {
  id: string;
  name: string;
  managedBy?: string | null;
  readonly?: boolean;
  slugFieldName?: string;
}

interface CollectionItem {
  id: string;
  slug: string;
  draft?: boolean;
  fieldData?: Record<string, unknown>;
}

interface EnumCase {
  id: string;
  name: string;
}

interface CollectionField {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  cases?: EnumCase[];
}

export interface FieldNameMap {
  [fieldId: string]: string;
}

export interface FieldTypeMap {
  [fieldId: string]: string;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isCollectionArray(data: unknown): data is CollectionInfo[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      typeof (item as CollectionInfo).name === "string",
  );
}

function isCollectionItemArray(data: unknown): data is CollectionItem[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "slug" in item,
  );
}

function isEnumCaseArray(data: unknown): data is EnumCase[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      !("slug" in item) &&
      !("managedBy" in item),
  );
}

function isCollectionFieldArray(data: unknown): data is CollectionField[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      "type" in item &&
      typeof (item as CollectionField).type === "string",
  );
}

// ---------------------------------------------------------------------------
// Collection Cards — grid of cards showing collection name + metadata
// ---------------------------------------------------------------------------

function CollectionCards({ collections }: { collections: CollectionInfo[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {collections.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2.5 rounded-lg border border-fresco-divider bg-fresco-surface-muted px-3 py-2.5"
        >
          <Database
            className="mt-0.5 size-4 shrink-0 text-fresco-tint"
            weight="duotone"
          />
          
            <span className="block truncate text-xs font-medium text-fresco-title">
              {c.name}
            </span>
            {/* {c.readonly && (
                <Badge
                  variant="secondary"
                  className="h-4 gap-0.5 rounded px-1 text-[9px] font-medium"
                >
                  <Lock className="size-2.5" weight="bold" />
                  Read-only
                </Badge>
              )} */}
              {/* {c.managedBy && (
                <Badge
                  variant="secondary"
                  className="h-4 rounded px-1 text-[9px] font-medium"
                >
                  {c.managedBy}
                </Badge>
              )} */}
            
          
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collection Items Table — compact table with slug + draft status + fields
// ---------------------------------------------------------------------------

/** Pick display columns, preferring an image field and then readable text fields. */
function pickDisplayColumns(
  items: CollectionItem[],
  fieldTypes?: FieldTypeMap,
): string[] {
  const imageFieldKeys = new Set<string>();
  const textFieldKeys = new Set<string>();

  for (const item of items) {
    if (!item.fieldData) continue;
    for (const [key, val] of Object.entries(item.fieldData)) {
      if (fieldTypes?.[key] === "image" && typeof val === "string" && val.length > 0) {
        imageFieldKeys.add(key);
        continue;
      }

      if (typeof val === "string" && val.length > 0 && val.length < 200) {
        textFieldKeys.add(key);
      }
    }

    if (imageFieldKeys.size >= 1 && textFieldKeys.size >= 3) break;
  }

  return [...imageFieldKeys].slice(0, 1).concat([...textFieldKeys].slice(0, 3));
}

function truncate(val: unknown, max = 40): string {
  if (val == null) return "—";
  // Handle { url, alt } image objects
  if (typeof val === "object" && "url" in (val as Record<string, unknown>)) {
    const url = String((val as { url: string }).url);
    return url.length > max ? url.slice(0, max) + "…" : url;
  }
  const s = String(val);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function CollectionItemsTable({
  items,
  fieldNames,
  fieldTypes,
}: {
  items: CollectionItem[];
  fieldNames?: FieldNameMap;
  fieldTypes?: FieldTypeMap;
}) {
  const displayCols = pickDisplayColumns(items, fieldTypes);
  const MAX_ROWS = 10;
  const visibleItems = items.slice(0, MAX_ROWS);
  const overflow = items.length - MAX_ROWS;

  /** Resolve a field ID to a human-readable name. */
  const colLabel = (fieldId: string) => fieldNames?.[fieldId] ?? fieldId;
  const isImageField = (fieldId: string) => fieldTypes?.[fieldId] === "image";

  return (
    <div className="overflow-hidden rounded-lg border border-fresco-divider">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-fresco-divider bg-fresco-surface-muted">
              <th className="px-2.5 py-1.5 text-left font-medium text-fresco-subtitle">
                Slug
              </th>
              <th className="px-2.5 py-1.5 text-left font-medium text-fresco-subtitle">
                Status
              </th>
              {displayCols.map((col) => (
                <th
                  key={col}
                  className="px-2.5 py-1.5 text-left font-medium text-fresco-subtitle"
                >
                  {colLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr
                key={item.id}
                className="border-b border-fresco-divider last:border-b-0"
              >
                <td className="max-w-[120px] truncate px-2.5 py-1.5 font-mono text-fresco-title">
                  {item.slug}
                </td>
                <td className="px-2.5 py-1.5">
                  <Badge
                    variant={item.draft ? "outline" : "secondary"}
                    className="h-4 rounded px-1 text-[9px] font-medium"
                  >
                    {item.draft ? "Draft" : "Published"}
                  </Badge>
                </td>
                {displayCols.map((col) => {
                  const cellVal = item.fieldData?.[col];
                  // Image values can be a URL string or { url, alt } object
                  const imageUrl =
                    isImageField(col) && cellVal
                      ? typeof cellVal === "string"
                        ? cellVal
                        : typeof cellVal === "object" &&
                            "url" in (cellVal as Record<string, unknown>)
                          ? (cellVal as { url: string }).url
                          : null
                      : null;

                  return (
                    <td
                      key={col}
                      className="max-w-[140px] truncate px-2.5 py-1.5 text-fresco-description"
                    >
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={
                            (typeof cellVal === "object" &&
                              cellVal !== null &&
                              "alt" in cellVal &&
                              (cellVal as { alt?: string }).alt) ||
                            colLabel(col)
                          }
                          className="block h-8 w-[76px] max-w-none overflow-hidden rounded-lg border border-fresco-divider bg-fresco-surface-muted object-cover object-center"
                          loading="lazy"
                          src={imageUrl}
                        />
                      ) : (
                        truncate(cellVal)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overflow > 0 && (
        <div className="border-t border-fresco-divider bg-fresco-surface-muted px-2.5 py-1.5 text-center text-[10px] text-fresco-subtitle">
          +{overflow} more item{overflow !== 1 ? "s" : ""}
        </div>
      )}
      <div className="flex items-center gap-1.5 border-t border-fresco-divider bg-fresco-surface-muted px-2.5 py-1.5 text-[10px] text-fresco-subtitle">
        <Rows className="size-3" weight="bold" />
        <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collection Fields — compact list of field name + type badge
// ---------------------------------------------------------------------------

function CollectionFields({ fields }: { fields: CollectionField[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-fresco-divider">
      <div className="flex flex-wrap gap-1.5 bg-fresco-surface-muted px-3 py-2.5">
        {fields.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-1.5 rounded-md border border-fresco-divider bg-fresco-panel px-2 py-1"
          >
            <span className="text-[11px] font-medium text-fresco-title">
              {f.name}
            </span>
            {/* <Badge variant="secondary" className="h-4 rounded px-1 text-[9px] font-normal">
              {f.type}
            </Badge> */}
            {f.required && (
              <span className="text-[9px] text-fresco-tint">*</span>
            )}
          </div>
        ))}
      </div>
      {/* <div className="flex items-center gap-1.5 border-t border-fresco-divider bg-fresco-surface-muted px-2.5 py-1.5 text-[10px] text-fresco-subtitle">
        <ListBullets className="size-3" weight="bold" />
        <span>{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
      </div> */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enum Chips — wrapped row of chips for enum cases
// ---------------------------------------------------------------------------

function EnumChips({ cases }: { cases: EnumCase[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-fresco-divider bg-fresco-surface-muted px-3 py-2.5">
      <Tag
        className="size-3.5 shrink-0 text-fresco-subtitle"
        weight="duotone"
      />
      {cases.map((c) => (
        <Badge
          key={c.id}
          variant="secondary"
          className="h-5 rounded-md px-2 text-[10px] font-medium"
        >
          {c.name}
        </Badge>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main renderer — tries to match tool output to a rich UI, falls back to null
// ---------------------------------------------------------------------------

export function renderFramerToolOutput(
  toolName: string,
  output: unknown,
  fieldNames?: FieldNameMap,
  fieldTypes?: FieldTypeMap,
): React.ReactNode | null {
  if (!output || typeof output !== "object") return null;

  // Handle truncated results — don't try to render custom UI
  if ("_truncated" in (output as Record<string, unknown>)) return null;

  // Collections list
  if (
    (toolName === "framer_get_collections") &&
    isCollectionArray(output)
  ) {
    return <CollectionCards collections={output} />;
  }

  // Collection items — handles both new shape { _fieldNames, items } and legacy array
  if (toolName === "framer_get_collection_items") {
    const obj = output as Record<string, unknown>;
    let items: CollectionItem[] | null = null;
    let mergedFieldNames = fieldNames;
    let mergedFieldTypes = fieldTypes;

    if ("items" in obj && Array.isArray(obj.items) && isCollectionItemArray(obj.items)) {
      items = obj.items;
      // Merge inline _fieldNames from the tool response (always available)
      if ("_fieldNames" in obj && typeof obj._fieldNames === "object" && obj._fieldNames) {
        mergedFieldNames = { ...fieldNames, ...(obj._fieldNames as FieldNameMap) };
      }
      if ("_fieldTypes" in obj && typeof obj._fieldTypes === "object" && obj._fieldTypes) {
        mergedFieldTypes = { ...fieldTypes, ...(obj._fieldTypes as FieldTypeMap) };
      }
    } else if (isCollectionItemArray(output)) {
      items = output;
    }

    if (items) {
      return (
        <CollectionItemsTable
          items={items}
          fieldNames={mergedFieldNames}
          fieldTypes={mergedFieldTypes}
        />
      );
    }
  }

  // Collection fields
  if (
    toolName === "framer_get_collection_fields" &&
    isCollectionFieldArray(output)
  ) {
    return <CollectionFields fields={output} />;
  }

  // Enum cases
  if (
    toolName === "framer_get_enum_cases" &&
    isEnumCaseArray(output)
  ) {
    return <EnumChips cases={output} />;
  }

  return null;
}
