import "server-only";

import {
  getAllCollections,
  getCollectionFields,
  getEnumFieldCases,
  getProjectInfo,
} from "@/lib/framer";
import { logEvent, logError } from "@/lib/logger";

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
}

interface EnumSnapshot {
  fieldId: string;
  fieldName: string;
  cases: Array<{ id: string; name: string }>;
}

interface CollectionContext {
  collection: CollectionSnapshot;
  fields: FieldSnapshot[];
  enumCases: EnumSnapshot[];
}

export interface AIContextSnapshot {
  project: { id: string; name: string } | null;
  collections: CollectionContext[];
}

// In-memory cache with TTL — snapshot data changes rarely
const SNAPSHOT_CACHE_TTL_MS = 60_000;

let snapshotCache: {
  expiresAt: number;
  value: AIContextSnapshot;
} | null = null;

/**
 * Build a full context snapshot for the AI system prompt.
 * Fetches project info, all collections, their fields, and enum cases.
 * Results are cached for 60s.
 */
export async function getAIContextSnapshot(): Promise<AIContextSnapshot> {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.value;
  }

  const startMs = Date.now();

  // Fetch project info + collection list in parallel
  const [project, rawCollections] = await Promise.all([
    getProjectInfo().catch((err) => {
      logError("ai.context_snapshot.project_info_failed", err);
      return null;
    }),
    getAllCollections().catch((err) => {
      logError("ai.context_snapshot.collections_failed", err);
      return [] as CollectionSnapshot[];
    }),
  ]);

  // For each collection, fetch fields (and enum cases for any enum fields)
  const collections = await Promise.all(
    rawCollections.map(async (col): Promise<CollectionContext> => {
      let fields: FieldSnapshot[] = [];
      let enumCases: EnumSnapshot[] = [];

      try {
        const rawFields = await getCollectionFields(col.id);
        fields = rawFields.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          required: f.required,
        }));

        // Fetch enum cases for all enum fields in this collection
        const enumFields = fields.filter((f) => f.type === "enum");
        if (enumFields.length > 0) {
          const enumResults = await Promise.all(
            enumFields.map(async (field) => {
              try {
                const cases = await getEnumFieldCases(col.id, field.id);
                return { fieldId: field.id, fieldName: field.name, cases };
              } catch (err) {
                logError("ai.context_snapshot.enum_cases_failed", err, {
                  collectionId: col.id,
                  fieldId: field.id,
                });
                return null;
              }
            }),
          );
          enumCases = enumResults.filter((r): r is EnumSnapshot => r !== null);
        }
      } catch (err) {
        logError("ai.context_snapshot.fields_failed", err, {
          collectionId: col.id,
        });
      }

      return { collection: col, fields, enumCases };
    }),
  );

  const snapshot: AIContextSnapshot = { project, collections };

  snapshotCache = {
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
    value: snapshot,
  };

  logEvent("info", "ai.context_snapshot.built", {
    durationMs: Date.now() - startMs,
    collectionCount: collections.length,
    totalFields: collections.reduce((sum, c) => sum + c.fields.length, 0),
    totalEnumFields: collections.reduce((sum, c) => sum + c.enumCases.length, 0),
  });

  return snapshot;
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
              .map((f) => `    - ${f.name} (id: ${f.id}, type: ${f.type}${f.required ? ", required" : ""})`)
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

  if (parts.length === 0) return "";

  return `PRE-LOADED CONTEXT — you already have this data, do NOT re-fetch it with tool calls unless you need to refresh after a mutation:
${parts.join("\n\n")}`;
}
