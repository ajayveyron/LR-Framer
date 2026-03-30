import "server-only";

import {
  getAllCollections,
  getCollectionFields,
  getCollectionItems,
  getEnumFieldCases,
  getProjectInfo,
} from "@/lib/framer";
import { logEvent, logError } from "@/lib/logger";
import { mapWithConcurrency } from "@/lib/shared-utils";

// ---------------------------------------------------------------------------
// AI Context Snapshot
//
// Pre-fetches Framer project context so the AI agent starts every chat
// already knowing collections, their fields, enum cases, and project info —
// eliminating redundant tool calls in every new conversation.
// ---------------------------------------------------------------------------

interface CollectionSnapshot {
  id: string;
  name: string;
  managedBy?: string | null;
  readonly?: boolean;
}

interface FieldSnapshot {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  /** For collectionReference / multiCollectionReference fields */
  collectionId?: string;
}

interface EnumSnapshot {
  fieldId: string;
  fieldName: string;
  cases: Array<{ id: string; name: string }>;
}

interface ReferenceOption {
  id: string;
  label: string;
  slug: string;
}

interface ReferenceSnapshot {
  collectionId: string;
  collectionName: string;
  options: ReferenceOption[];
}

interface CollectionContext {
  collection: CollectionSnapshot;
  fields: FieldSnapshot[];
  enumCases: EnumSnapshot[];
}

type RunInFramerContext = <T>(fn: () => Promise<T>) => Promise<T>;

interface AIContextSnapshotOptions {
  cacheKey?: string;
  focusCollectionId?: string;
}

export interface AIContextSnapshot {
  project: { id: string; name: string } | null;
  collections: CollectionContext[];
  /** Deduplicated reference collection options, keyed by collection ID */
  references: Map<string, ReferenceSnapshot>;
}

// In-memory cache with TTL — snapshot data changes rarely
const SNAPSHOT_CACHE_TTL_MS = 300_000;
const SNAPSHOT_COLLECTION_CONCURRENCY = 10;
const SNAPSHOT_ENUM_CONCURRENCY = 10;

// Bounded cache: evict oldest entries when exceeding MAX_CACHE_ENTRIES
// to prevent unbounded memory growth in long-running processes.
const MAX_CACHE_ENTRIES = 20;

const snapshotCache = new Map<
  string,
  {
    expiresAt: number;
    value: AIContextSnapshot;
  }
>();
const snapshotInFlight = new Map<string, Promise<AIContextSnapshot>>();

const DEFAULT_SNAPSHOT_CACHE_KEY = "__default__";

function evictExpiredCacheEntries() {
  const now = Date.now();
  for (const [key, entry] of snapshotCache) {
    if (entry.expiresAt <= now) snapshotCache.delete(key);
  }
  // If still over limit, remove oldest entries
  while (snapshotCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = snapshotCache.keys().next().value;
    if (firstKey !== undefined) snapshotCache.delete(firstKey);
  }
}

/**
 * Build a full context snapshot for the AI system prompt.
 * Fetches project info, all collections, their fields, and enum cases.
 * Results are cached for 60s.
 */
export async function getAIContextSnapshot(): Promise<AIContextSnapshot> {
  return getAIContextSnapshotWithRunner();
}

export async function getAIContextSnapshotWithRunner(
  runInFramerContext?: RunInFramerContext,
  options: AIContextSnapshotOptions = {},
): Promise<AIContextSnapshot> {
  const cacheKey = options.cacheKey ?? DEFAULT_SNAPSHOT_CACHE_KEY;
  const cached = snapshotCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inFlight = snapshotInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const buildPromise = (async () => {
    const startMs = Date.now();
    let projectAndCollectionsMs = 0;
    let fieldsMs = 0;
    let referencesMs = 0;

    const projectCollectionsStartMs = Date.now();

    // Fetch project info + collection list in parallel
    const [project, rawCollections] = await Promise.all([
      (runInFramerContext
        ? runInFramerContext(() => getProjectInfo())
        : getProjectInfo()
      ).catch((err) => {
        logError("ai.context_snapshot.project_info_failed", err);
        return null;
      }),
      (runInFramerContext
        ? runInFramerContext(() => getAllCollections())
        : getAllCollections()
      ).catch((err) => {
        logError("ai.context_snapshot.collections_failed", err);
        return [] as CollectionSnapshot[];
      }),
    ]);

    projectAndCollectionsMs = Date.now() - projectCollectionsStartMs;

    const fieldsStartMs = Date.now();

    // For each collection, fetch fields (and enum cases for any enum fields)
    const collections = await mapWithConcurrency(
      rawCollections,
      SNAPSHOT_COLLECTION_CONCURRENCY,
      async (col): Promise<CollectionContext> => {
        let fields: FieldSnapshot[] = [];
        let enumCases: EnumSnapshot[] = [];

        try {
          const rawFields = await (runInFramerContext
            ? runInFramerContext(() => getCollectionFields(col.id))
            : getCollectionFields(col.id));
          fields = rawFields.map((f: any) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            required: f.required,
            ...(f.collectionId ? { collectionId: f.collectionId } : {}),
          }));

          // Fetch enum cases for all enum fields in this collection
          const enumFields = fields.filter((f) => f.type === "enum");
          if (enumFields.length > 0) {
            const enumResults = await mapWithConcurrency(
              enumFields,
              SNAPSHOT_ENUM_CONCURRENCY,
              async (field) => {
                try {
                  const cases = await (runInFramerContext
                    ? runInFramerContext(() =>
                        getEnumFieldCases(col.id, field.id),
                      )
                    : getEnumFieldCases(col.id, field.id));
                  return { fieldId: field.id, fieldName: field.name, cases };
                } catch (err) {
                  logError("ai.context_snapshot.enum_cases_failed", err, {
                    collectionId: col.id,
                    fieldId: field.id,
                  });
                  return null;
                }
              },
            );
            enumCases = enumResults.filter((r): r is EnumSnapshot => r !== null);
          }
        } catch (err) {
          logError("ai.context_snapshot.fields_failed", err, {
            collectionId: col.id,
          });
        }

        return { collection: col, fields, enumCases };
      },
    );

    fieldsMs = Date.now() - fieldsStartMs;

    const snapshot: AIContextSnapshot = {
      project,
      collections,
      references: new Map(),
    };

    const referenceSourceCollections =
      options.focusCollectionId
        ? collections.filter((ctx) => ctx.collection.id === options.focusCollectionId)
        : collections;

    // Collect unique referenced collection IDs across the relevant fields.
    const refCollectionIds = new Set<string>();
    for (const ctx of referenceSourceCollections) {
      for (const field of ctx.fields) {
        if (
          (field.type === "collectionReference" ||
            field.type === "multiCollectionReference") &&
          field.collectionId
        ) {
          refCollectionIds.add(field.collectionId);
        }
      }
    }

    // Fetch items from each referenced collection to build options
    if (refCollectionIds.size > 0) {
      const referencesStartMs = Date.now();
      const SNAPSHOT_REF_CONCURRENCY = 10;
      const refEntries = await mapWithConcurrency(
        [...refCollectionIds],
        SNAPSHOT_REF_CONCURRENCY,
        async (refColId): Promise<[string, ReferenceSnapshot] | null> => {
          try {
            const data = await (runInFramerContext
              ? runInFramerContext(() => getCollectionItems(refColId))
              : getCollectionItems(refColId));

            // Find a title-like field for the label
            const titleFieldId = Object.entries(data._fieldTypes ?? {}).find(
              ([, type]) => type === "string" || type === "formattedText",
            )?.[0];

            const collectionName =
              collections.find((c) => c.collection.id === refColId)?.collection
                .name ?? refColId;

            return [
              refColId,
              {
                collectionId: refColId,
                collectionName,
                options: data.items.map((item: any) => ({
                  id: item.id,
                  label: titleFieldId
                    ? String(item.fieldData?.[titleFieldId] ?? item.slug)
                    : item.slug,
                  slug: item.slug,
                })),
              },
            ];
          } catch (err) {
            logError("ai.context_snapshot.reference_items_failed", err, {
              collectionId: refColId,
            });
            return null;
          }
        },
      );

      for (const entry of refEntries) {
        if (entry) {
          snapshot.references.set(entry[0], entry[1]);
        }
      }

      referencesMs = Date.now() - referencesStartMs;
    }

    evictExpiredCacheEntries();
    snapshotCache.set(cacheKey, {
      expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
      value: snapshot,
    });

    logEvent("info", "ai.context_snapshot.built", {
      durationMs: Date.now() - startMs,
      projectAndCollectionsMs,
      fieldsMs,
      referencesMs,
      collectionCount: collections.length,
      totalFields: collections.reduce((sum, c) => sum + c.fields.length, 0),
      totalEnumFields: collections.reduce((sum, c) => sum + c.enumCases.length, 0),
      totalReferenceCollections: snapshot.references.size,
      focusedCollectionId: options.focusCollectionId ?? null,
      focusedReferenceCollections: refCollectionIds.size,
    });

    return snapshot;
  })();

  snapshotInFlight.set(cacheKey, buildPromise);

  try {
    return await buildPromise;
  } finally {
    snapshotInFlight.delete(cacheKey);
  }
}

export function invalidateAIContextSnapshot(cacheKey?: string) {
  if (cacheKey) {
    snapshotCache.delete(cacheKey);
    return;
  }

  snapshotCache.clear();
}

/**
 * Format the snapshot into a system prompt block the agent can consume.
 */
export function formatSnapshotForPrompt(snapshot: AIContextSnapshot): string {
  const parts: string[] = [];

  if (snapshot.project) {
    parts.push(
      `PROJECT: "${snapshot.project.name}" (id: ${snapshot.project.id})`,
    );
  }

  if (snapshot.collections.length > 0) {
    const collectionBlocks = snapshot.collections.map((ctx) => {
      const flags = [
        ctx.collection.managedBy ? `managed by ${ctx.collection.managedBy}` : null,
        ctx.collection.readonly ? "readonly" : null,
      ]
        .filter(Boolean)
        .join(", ");

      const header = `"${ctx.collection.name}" (id: ${ctx.collection.id})${flags ? ` [${flags}]` : ""}`;

      const fieldLines =
        ctx.fields.length > 0
          ? ctx.fields
              .map((f) => {
                let line = `    - ${f.name} (id: ${f.id}, type: ${f.type}${f.required ? ", required" : ""})`;
                if (f.collectionId) {
                  const ref = snapshot.references.get(f.collectionId);
                  if (ref) {
                    line += ` → references "${ref.collectionName}"`;
                  }
                }
                return line;
              })
              .join("\n")
          : "    (no fields loaded)";

      const enumLines =
        ctx.enumCases.length > 0
          ? ctx.enumCases
              .map((e) => {
                const caseList = e.cases
                  .map((c) => `${c.name} (id: ${c.id})`)
                  .join(", ");
                return `    enum "${e.fieldName}" (fieldId: ${e.fieldId}): [${caseList}]`;
              })
              .join("\n")
          : "";

      return `  ${header}\n  Fields:\n${fieldLines}${enumLines ? `\n  Enum options:\n${enumLines}` : ""}`;
    });

    parts.push(`ALL COLLECTIONS:\n${collectionBlocks.join("\n\n")}`);
  }

  // Reference collection options — so the AI knows valid item IDs for reference fields
  if (snapshot.references.size > 0) {
    const refBlocks = [...snapshot.references.values()].map((ref) => {
      const optionList = ref.options
        .map((o) => `    - "${o.label}" (id: ${o.id}, slug: ${o.slug})`)
        .join("\n");
      return `  "${ref.collectionName}" (id: ${ref.collectionId}):\n${optionList || "    (empty)"}`;
    });
    parts.push(
      `REFERENCE COLLECTION OPTIONS — use the item ID (not slug or label) when setting collectionReference or multiCollectionReference fields:\n${refBlocks.join("\n\n")}`,
    );
  }

  if (parts.length === 0) return "";

  return `PRE-LOADED CONTEXT — you already have this data, do NOT re-fetch it with tool calls unless you need to refresh after a mutation:
${parts.join("\n\n")}`;
}
