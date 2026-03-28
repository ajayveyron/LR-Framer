import type { CmsActionAddItems } from "@/lib/cms-action-types";
import type {
  BlogCollectionMetadata,
  DashboardFieldDefinition,
} from "@/lib/cms-types";

type ValidationFieldDefinition = {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  supported?: boolean;
  options?: DashboardFieldDefinition["options"];
  referenceCollection?: DashboardFieldDefinition["referenceCollection"];
};

export interface AddItemFieldIssue {
  slug: string;
  fieldId: string;
  fieldName: string;
  type: string;
  issue: "missing" | "invalid";
  message: string;
}

export interface AddItemsValidationResult {
  blockingIssues: AddItemFieldIssue[];
  warningIssues: AddItemFieldIssue[];
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isMeaningfullyPresent(
  value: unknown,
  type: string,
) {
  switch (type) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "multiCollectionReference":
      return Array.isArray(value) && value.length > 0;
    case "image":
      if (typeof value === "string") return value.trim().length > 0;
      if (value && typeof value === "object" && "url" in value) {
        const url = (value as { url?: unknown }).url;
        return typeof url === "string" && url.trim().length > 0;
      }
      return false;
    default:
      return typeof value === "string" ? value.trim().length > 0 : value != null;
  }
}

function collectAllowedValues(field: ValidationFieldDefinition) {
  const allowed = new Set<string>();

  for (const option of field.options ?? []) {
    if (option.id) allowed.add(option.id.trim());
    allowed.add(option.value.trim());
    allowed.add(normalizeLabel(option.label));
  }

  for (const option of field.referenceCollection?.options ?? []) {
    allowed.add(option.id.trim());
    allowed.add(option.slug.trim());
    allowed.add(normalizeLabel(option.label));
  }

  return allowed;
}

function isAllowedChoice(
  field: ValidationFieldDefinition,
  value: unknown,
) {
  const allowed = collectAllowedValues(field);
  if (allowed.size === 0) return true;

  if (field.type === "multiCollectionReference") {
    if (!Array.isArray(value)) return false;
    return value.every(
      (entry) =>
        typeof entry === "string" &&
        (allowed.has(entry) || allowed.has(normalizeLabel(entry))),
    );
  }

  if (typeof value !== "string") return false;
  return allowed.has(value) || allowed.has(normalizeLabel(value));
}

function getRelevantFields(
  fields: ValidationFieldDefinition[],
) {
  return fields.filter(
    (field) =>
      field.required &&
      field.type !== "divider" &&
      field.type !== "unsupported" &&
      field.supported !== false,
  );
}

export function validateAddItemsAction(
  action: CmsActionAddItems,
  fields: ValidationFieldDefinition[],
): AddItemsValidationResult {
  const blockingIssues: AddItemFieldIssue[] = [];
  const warningIssues: AddItemFieldIssue[] = [];
  const requiredFields = getRelevantFields(fields);

  for (const item of action.items) {
    for (const field of requiredFields) {
      const entry = item.fieldData?.[field.id];
      const value = entry?.value;
      const present = isMeaningfullyPresent(value, field.type);

      if (!present) {
        blockingIssues.push({
          slug: item.slug,
          fieldId: field.id,
          fieldName: field.name,
          type: field.type,
          issue: "missing",
          message: `"${field.name}" is required for "${item.slug}".`,
        });
        continue;
      }

      if (
        (field.type === "enum" ||
          field.type === "collectionReference" ||
          field.type === "multiCollectionReference") &&
        !isAllowedChoice(field, value)
      ) {
        blockingIssues.push({
          slug: item.slug,
          fieldId: field.id,
          fieldName: field.name,
          type: field.type,
          issue: "invalid",
          message: `"${field.name}" on "${item.slug}" does not match an available option.`,
        });
      }
    }
  }

  return { blockingIssues, warningIssues };
}

export function validateAddItemsAgainstMetadata(
  action: CmsActionAddItems,
  metadata?: BlogCollectionMetadata,
): AddItemsValidationResult {
  if (!metadata || metadata.collectionId !== action.collectionId) {
    return { blockingIssues: [], warningIssues: [] };
  }

  return validateAddItemsAction(action, metadata.fields);
}

export function formatAddItemsValidationError(
  validation: AddItemsValidationResult,
) {
  const grouped = new Map<string, string[]>();

  for (const issue of validation.blockingIssues) {
    const existing = grouped.get(issue.slug) ?? [];
    existing.push(issue.fieldName);
    grouped.set(issue.slug, existing);
  }

  const summary = [...grouped.entries()]
    .map(([slug, fields]) => `${slug}: ${fields.join(", ")}`)
    .join("; ");

  return `The proposal is missing required fields or contains invalid references. ${summary}`;
}

export function summarizeValidationIssues(
  issues: AddItemFieldIssue[],
  maxItems = 6,
) {
  return issues.slice(0, maxItems).map((issue) => ({
    key: `${issue.slug}:${issue.fieldId}:${issue.issue}`,
    label: issue.slug,
    message:
      issue.issue === "missing"
        ? `Missing ${issue.fieldName}`
        : `Invalid ${issue.fieldName}`,
  }));
}
