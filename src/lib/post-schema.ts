import { z } from "zod";

import type {
  BlogCollectionMetadata,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";

export interface PostInputPayload {
  slug: string;
  fieldValues: Record<string, unknown>;
  draft?: boolean;
}

export interface ValidatedPostInput {
  slug: string;
  fieldValues: Record<string, DashboardFieldValue>;
  draft?: boolean;
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildStringSchema(
  field: DashboardFieldDefinition,
  options?: {
    invalidMessage?: string;
    validate?: (value: string) => boolean;
  },
) {
  const base = z
    .string()
    .superRefine((value, context) => {
      const trimmed = value.trim();
      if (!trimmed) {
        if (field.required) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `"${field.name}" is required.`,
          });
        }
        return;
      }

      if (options?.validate && !options.validate(trimmed)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: options.invalidMessage ?? `"${field.name}" is invalid.`,
        });
      }
    });

  // Always optional at the Zod level — the form only sends fields it knows about.
  // Required-ness is enforced inside the superRefine when a value IS provided.
  return base.optional();
}

function buildNumberSchema(field: DashboardFieldDefinition) {
  const base = z
    .union([
      z.number(),
      z.string(),
    ])
    .superRefine((value, context) => {
      if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `"${field.name}" must be a number.`,
          });
        }
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        if (field.required) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `"${field.name}" is required.`,
          });
        }
        return;
      }

      if (!Number.isFinite(Number(trimmed))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${field.name}" must be a number.`,
        });
      }
    });

  return base.optional();
}

function isValidDateValue(value: string, displayTime?: boolean) {
  // Accept Framer's full ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ) for any date field
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return !Number.isNaN(new Date(value).valueOf());
  }

  if (displayTime) {
    // Also accept the short datetime-local format from HTML inputs
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
      !Number.isNaN(new Date(value).valueOf());
  }

  // Also accept the short date-only format from HTML inputs
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00.000Z`).valueOf());
}

function buildAllowedChoiceMatcher(field: DashboardFieldDefinition) {
  const allowed = new Set<string>();

  for (const option of field.options ?? []) {
    if (option.id) {
      allowed.add(option.id.trim());
    }
    allowed.add(option.value.trim());
    allowed.add(normalizeLabel(option.label));
  }

  for (const option of field.referenceCollection?.options ?? []) {
    allowed.add(option.id.trim());
    allowed.add(option.slug.trim());
    allowed.add(normalizeLabel(option.label));
  }

  return (value: string) => {
    if (allowed.size === 0) {
      return true;
    }

    return allowed.has(value) || allowed.has(normalizeLabel(value));
  };
}

function buildBooleanSchema(field: DashboardFieldDefinition) {
  const schema = z.boolean({
    message: `"${field.name}" must be true or false.`,
  });

  return schema.optional();
}

function buildMultiReferenceSchema(field: DashboardFieldDefinition) {
  const matchesAllowedChoice = buildAllowedChoiceMatcher(field);
  const base = z
    .array(
      z.string(),
    )
    .superRefine((values, context) => {
      if (field.required && values.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${field.name}" is required.`,
        });
      }

      for (const value of values) {
        const trimmed = value.trim();
        if (!trimmed || !matchesAllowedChoice(trimmed)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `"${field.name}" must match an available reference.`,
          });
          return;
        }
      }
    });

  return base.optional();
}

function buildFieldValueSchema(field: DashboardFieldDefinition) {
  switch (field.type) {
    case "boolean":
      return buildBooleanSchema(field);
    case "number":
      return buildNumberSchema(field);
    case "date":
      return buildStringSchema(field, {
        invalidMessage: `"${field.name}" must be a valid ${field.displayTime ? "date and time" : "date"}.`,
        validate: (value) => isValidDateValue(value, field.displayTime),
      });
    case "enum":
      return buildStringSchema(field, {
        invalidMessage: `"${field.name}" must match an available option.`,
        validate: buildAllowedChoiceMatcher(field),
      });
    case "collectionReference":
      return buildStringSchema(field, {
        invalidMessage: `"${field.name}" must match an available reference.`,
        validate: buildAllowedChoiceMatcher(field),
      });
    case "multiCollectionReference":
      return buildMultiReferenceSchema(field);
    case "string":
    case "formattedText":
    case "link":
    case "image":
    case "file":
    case "color":
      return buildStringSchema(field);
    default:
      return z.unknown().optional();
  }
}

export function buildPostInputSchema(
  metadata: BlogCollectionMetadata,
) {
  const supportedFields = metadata.fields.filter((field) => field.supported);
  const fieldShape = Object.fromEntries(
    supportedFields.map((field) => [field.id, buildFieldValueSchema(field)]),
  ) as Record<string, z.ZodTypeAny>;

  return z.object({
    slug: z
      .string()
      .trim()
      .transform((value) => {
        if (value.length > 0) {
          return value;
        }
        // Slug is empty — will be derived from title in parsePostInput
        return "";
      })
      .refine(
        (value) => value === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
        "Use lowercase letters, numbers, and hyphens only.",
      ),
    draft: z.boolean().optional(),
    fieldValues: z.object(fieldShape).passthrough(),
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parsePostInput(
  metadata: BlogCollectionMetadata,
  payload: unknown,
): ValidatedPostInput {
  const parsed = buildPostInputSchema(metadata).parse(payload) as ValidatedPostInput;

  if (!parsed.slug) {
    const titleFieldId = metadata.logicalFields.title;
    const titleValue = titleFieldId ? parsed.fieldValues[titleFieldId] : undefined;

    if (typeof titleValue === "string" && titleValue.trim().length > 0) {
      parsed.slug = slugify(titleValue);
    }

    if (!parsed.slug) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Slug is required when no title is provided.",
          path: ["slug"],
        },
      ]);
    }
  }

  return parsed;
}
