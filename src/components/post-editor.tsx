"use client";

import {
  startTransition,
  type ChangeEvent,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AsteriskSimple as AsteriskIcon,
  Sparkle,
  SpinnerGap,
  ChatCircle,
} from "@phosphor-icons/react";

import { AIImageDialog } from "@/components/ai-image-dialog";
import { useNotify } from "@/components/notification-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";
import { TRANSIENT_FRAMER_EDITOR_MESSAGE } from "@/lib/framer-copy";

import { cn } from "@/lib/utils";
import { extractImageJobId } from "@/lib/ai-image-placeholders";
import { buildPostInputSchema, type PostInputPayload } from "@/lib/post-schema";
import { getCollectionHeader } from "@/lib/product-framer-shared";
import { useImageJob } from "@/lib/use-image-job";

import { slugify } from "./post-editor/rich-text-utils";
import { RichTextInput } from "./post-editor/content-editable-editor";

type FormValues = PostInputPayload;
const EMPTY_SELECT_VALUE = "__none__";
const fieldClassName = "flex flex-col gap-2";
const wideFieldClassName = "max-w-none";
const labelRowClassName = "flex items-center justify-between gap-2.5";
const metaBadgeClassName =
  "h-6 rounded-full border border-fresco-divider bg-fresco-surface-muted px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-fresco-subtitle";
const helperTextClassName =
  "text-[13px] leading-[1.45] text-fresco-subtitle";
const fieldErrorClassName =
  "text-[13px] text-fresco-danger-callout-text";
const formControlClassName =
  "border-fresco-input-border bg-fresco-input-bg text-fresco-text shadow-[inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)] placeholder:text-[color-mix(in_srgb,var(--color-fresco-text)_34%,transparent)] focus-visible:border-fresco-input-active focus-visible:shadow-[0_0_0_4px_var(--color-fresco-tint-dimmed),inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)] h-10 rounded-lg border px-3 py-2.5 font-sans text-sm leading-[1.4]";
const titleControlClassName =
  "h-12 text-[clamp(20px,1.7vw,26px)] leading-[1.1] tracking-[-0.03em]";
const primaryButtonClassName =
  "bg-fresco-button-primary text-fresco-button-primary-text shadow-[0_10px_28px_rgba(0,0,0,0.2)] hover:bg-fresco-button-primary-hover";
const warningBannerClassName =
  "rounded-none border border-fresco-accent-callout-border bg-fresco-accent-callout-bg px-4 py-3 text-sm text-fresco-accent-callout-text";

function getAssetLabel(value: string) {
  try {
    const pathname = new URL(value).pathname;
    return pathname.split("/").at(-1) || value;
  } catch {
    return value.split("/").at(-1) || value;
  }
}

function formatDateValue(value: DashboardFieldValue, displayTime?: boolean) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  if (displayTime) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  }

  return date.toISOString().slice(0, 10);
}

function getDefaultFieldValue(
  field: DashboardFieldDefinition,
  post: BlogPostRecord | null,
) {
  const value = post?.fieldValues[field.id];

  switch (field.type) {
    case "boolean":
      return typeof value === "boolean" ? value : false;
    case "number":
      return typeof value === "number" ? value : "";
    case "multiCollectionReference":
      return Array.isArray(value) ? value : [];
    case "date":
      return formatDateValue(value ?? null, field.displayTime);
    default:
      return value ?? "";
  }
}

function normalizeOptionLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getNormalizedEnumSelectValue(
  field: DashboardFieldDefinition,
  value: unknown,
) {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  const normalizedValue = normalizeOptionLabel(value);
  const matchedOption = (field.options ?? []).find(
    (option) =>
      option.value === value ||
      option.id === value ||
      normalizeOptionLabel(option.label) === normalizedValue,
  );

  return matchedOption?.value ?? value;
}

function getNormalizedReferenceSelectValue(
  field: DashboardFieldDefinition,
  value: unknown,
) {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  const normalizedValue = normalizeOptionLabel(value);
  const matchedOption = (field.referenceCollection?.options ?? []).find(
    (option) =>
      option.slug === value ||
      option.id === value ||
      normalizeOptionLabel(option.label) === normalizedValue,
  );

  return matchedOption?.slug ?? value;
}

function getNormalizedMultiReferenceSelectValues(
  field: DashboardFieldDefinition,
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => getNormalizedReferenceSelectValue(field, entry))
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function AssetFieldValue({
  field,
  inputId,
  path,
  currentValue,
  isUploading,
  onUpload,
  onRemove,
  onGenerate,
  onResolved,
}: {
  field: DashboardFieldDefinition;
  inputId: string;
  path: `fieldValues.${string}`;
  currentValue: DashboardFieldValue;
  isUploading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onGenerate: () => void;
  onResolved: (url: string) => void;
}) {
  const rawValue = typeof currentValue === "string" ? currentValue : "";
  const pendingJobId = extractImageJobId(rawValue);
  const imageJob = useImageJob(pendingJobId);
  const resolvedUrl =
    pendingJobId && imageJob?.status === "completed" && imageJob.url
      ? imageJob.url
      : "";
  const assetUrl = pendingJobId ? resolvedUrl : rawValue;
  const isGenerating =
    Boolean(pendingJobId) &&
    (!imageJob ||
      imageJob.status === "pending" ||
      imageJob.status === "running");
  const generationFailed =
    Boolean(pendingJobId) && imageJob?.status === "failed";
  const uploadId = `${inputId}-upload`;

  useEffect(() => {
    if (!resolvedUrl || resolvedUrl === rawValue) {
      return;
    }

    onResolved(resolvedUrl);
  }, [onResolved, rawValue, resolvedUrl]);

  return (
    <div className="flex flex-col gap-3">
      {assetUrl ? (
        <div className="rounded-none border border-fresco-divider bg-fresco-surface-elevated shadow-[inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)] flex items-center gap-3 rounded-lg p-3">
          {field.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={field.name}
              className="h-[80px] w-28 shrink-0 rounded-lg border border-fresco-divider object-cover"
              src={assetUrl}
            />
          ) : (
            <div
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-fresco-surface-muted text-fresco-text"
            >
              <svg
                fill="none"
                height="22"
                viewBox="0 0 22 22"
                width="22"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.5 2.75H12.375L16.5 6.875V17.125C16.5 18.1605 15.6605 19 14.625 19H7.375C6.33947 19 5.5 18.1605 5.5 17.125V3.75C5.5 3.19772 5.94772 2.75 6.5 2.75Z"
                  fill="currentColor"
                  fillOpacity="0.12"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M12 2.75V7.25H16.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <strong className="truncate text-fresco-title">
              {getAssetLabel(assetUrl)}
            </strong>
            <div className="flex items-center gap-1.5">
              <Button
                asChild
                className="h-7 rounded-lg px-2.5 text-xs"
                size="sm"
                variant="outline"
              >
                <label htmlFor={uploadId}>
                  <input
                    accept={field.type === "image" ? "image/*" : undefined}
                    hidden
                    id={uploadId}
                    onChange={onUpload}
                    type="file"
                  />
                  {isUploading ? "Uploading..." : "Replace"}
                </label>
              </Button>
              {!field.required ? (
                <Button
                  className="h-7 rounded-lg px-2.5 text-xs"
                  onClick={onRemove}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              ) : null}
              {field.type === "image" ? (
                <Button
                  className="h-7 rounded-lg px-2.5 text-xs"
                  onClick={onGenerate}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Sparkle className="size-3.5" weight="duotone" />
                  AI
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!assetUrl && isGenerating ? (
        <div className="rounded-lg border border-fresco-divider bg-fresco-surface-elevated p-3 text-sm text-fresco-description shadow-[inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-2">
            <SpinnerGap className="size-4 animate-spin text-fresco-tint" />
            <span>AI thumbnail is still generating. It will attach automatically when ready.</span>
          </div>
        </div>
      ) : null}

      {!assetUrl && generationFailed ? (
        <div className="rounded-lg border border-fresco-danger-callout-border bg-fresco-danger-callout-bg p-3 text-sm text-fresco-danger-callout-text">
          {imageJob?.error ?? "AI thumbnail generation failed."}
        </div>
      ) : null}

      {!assetUrl && !isGenerating ? (
        <>
          <div className="rounded-lg border border-dashed border-fresco-divider bg-fresco-surface-subtle px-3 py-2 text-sm text-fresco-subtitle">
            No {field.name.toLowerCase()} attached yet.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              asChild
              className="h-9 rounded-lg px-3"
              size="sm"
              variant="outline"
            >
              <label htmlFor={uploadId}>
                <input
                  accept={field.type === "image" ? "image/*" : undefined}
                  hidden
                  id={uploadId}
                  onChange={onUpload}
                  type="file"
                />
                {isUploading ? "Uploading..." : "Upload"}
              </label>
            </Button>
            {field.type === "image" ? (
              <Button
                className="h-9 rounded-lg px-3"
                onClick={onGenerate}
                size="sm"
                type="button"
                variant="outline"
              >
                <Sparkle className="size-4" weight="duotone" />
                Generate Image
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function getFieldErrorMessage(
  errors: FormValues["fieldValues"] | undefined,
  fieldId: string,
) {
  const entry = errors?.[fieldId] as { message?: string } | undefined;
  return entry?.message;
}

function isLongTextField(field: DashboardFieldDefinition) {
  if (field.type === "formattedText") {
    return true;
  }

  return (
    field.type === "string" &&
    (field.logicalKey === "body" ||
      /description|summary|excerpt/i.test(field.name))
  );
}

function FieldLabel({
  htmlFor,
  name,
  required = false,
}: {
  htmlFor?: string;
  name: string;
  required?: boolean;
}) {
  return (
    <Label
      className="text-[13px] tracking-wide text-fresco-title"
      htmlFor={htmlFor}
    >
      {name}
      {required ? (
        <>
          <span
            aria-hidden="true"
            className="inline-flex text-fresco-error"
          >
            <AsteriskIcon className="size-2" weight="bold" />
          </span>
          <span className="sr-only"> required</span>
        </>
      ) : null}
    </Label>
  );
}

function ReadOnlyField({
  field,
  value,
}: {
  field: DashboardFieldDefinition;
  value: DashboardFieldValue;
}) {
  return (
    <div className={cn(fieldClassName, wideFieldClassName)}>
      <div className={labelRowClassName}>
        <Label>{field.name}</Label>
        <Badge className={metaBadgeClassName} variant="outline">
          Read only
        </Badge>
      </div>
      <div className={warningBannerClassName}>
        {field.helpText ??
          "This field type is visible but not editable in the dashboard."}
      </div>
      <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle px-4 py-3 text-sm text-fresco-text">
        {Array.isArray(value) ? value.join(", ") : String(value ?? "")}
      </div>
    </div>
  );
}

export function PostEditor({
  activeCollectionId,
  framerUnavailable = false,
  metadata,
  mode,
  onClose,
  onPostSaved,
  post,
  onChatWithItem,
}: {
  activeCollectionId?: string;
  framerUnavailable?: boolean;
  metadata: BlogCollectionMetadata;
  mode: "create" | "edit";
  onClose: () => void;
  onPostSaved: (post: BlogPostRecord, mode: "create" | "edit") => void;
  post: BlogPostRecord | null;
  onChatWithItem?: () => void;
}) {
  const notify = useNotify();
  const [pending, startSaving] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [pendingUploads, setPendingUploads] = useState<Record<string, boolean>>(
    {},
  );
  const [aiImageFieldId, setAiImageFieldId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const titleFieldId = metadata.logicalFields.title;
  const bodyFieldId = metadata.logicalFields.body;
  const [validationSchema] = useState(() => buildPostInputSchema(metadata));
  const defaultValues: FormValues = {
    slug: post?.slug ?? "",
    fieldValues: Object.fromEntries(
      metadata.fields
        .filter((field) => field.supported)
        .map((field) => [field.id, getDefaultFieldValue(field, post)]),
    ),
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const watchedFieldValues = useWatch({
    control: form.control,
    name: "fieldValues",
  });
  const titleValue = titleFieldId
    ? watchedFieldValues?.[titleFieldId]
    : undefined;
  const supportedFields = metadata.fields.filter((field) => field.supported);
  const readOnlyFields = metadata.fields.filter((field) => !field.supported);
  const titleField = titleFieldId
    ? supportedFields.find((field) => field.id === titleFieldId)
    : undefined;
  const bodyField = bodyFieldId
    ? supportedFields.find((field) => field.id === bodyFieldId)
    : undefined;
  const remainingFields = supportedFields.filter(
    (field) => field.id !== titleField?.id && field.id !== bodyField?.id,
  );
  const nonContentFields = remainingFields.filter(
    (field) => field.type !== "formattedText" && field.logicalKey !== "body",
  );
  const contentFields = remainingFields.filter(
    (field) => field.type === "formattedText" || field.logicalKey === "body",
  );
  const drawerTitle =
    typeof titleValue === "string" && titleValue.trim().length > 0
      ? titleValue.trim()
      : mode === "create"
        ? "Untitled Draft"
        : (post?.title ?? post?.slug ?? "Untitled Entry");
  const statusLabel =
    mode === "create"
      ? "New Draft"
      : form.formState.isDirty
        ? "Unsaved Changes"
        : post?.draft
          ? "Saved Draft"
          : "Published";

  const syncSlugFromTitle = useEffectEvent((value: unknown) => {
    if (
      mode !== "create" ||
      !titleFieldId ||
      typeof value !== "string" ||
      form.getFieldState("slug").isDirty ||
      form.getValues("slug").length > 0
    ) {
      return;
    }

    form.setValue("slug", slugify(value), { shouldValidate: true });
  });

  useEffect(() => {
    syncSlugFromTitle(titleValue);
  }, [titleValue]);

  function resetForm() {
    form.reset(defaultValues);
    setServerError(null);
    setPendingValues(null);
  }

  async function handleAssetUpload(
    field: DashboardFieldDefinition,
    path: `fieldValues.${string}`,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    if (framerUnavailable) {
      notify.error(TRANSIENT_FRAMER_EDITOR_MESSAGE);
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setServerError(null);
    setPendingUploads((current) => ({
      ...current,
      [field.id]: true,
    }));

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", field.type === "image" ? "image" : "file");

      const response = await fetch("/api/uploads", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        error?: string;
        url?: string;
      };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Upload failed.");
      }

      form.setValue(path, data.url, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      notify.success(`${field.name} uploaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setServerError(message);
      notify.error(message);
    } finally {
      setPendingUploads((current) => ({
        ...current,
        [field.id]: false,
      }));
      event.target.value = "";
    }
  }

  function submitValues(values: FormValues, asDraft?: boolean) {
    if (framerUnavailable) {
      const message = TRANSIENT_FRAMER_EDITOR_MESSAGE;
      setServerError(message);
      notify.error(message);
      return;
    }

    setServerError(null);
    form.clearErrors();

    startSaving(async () => {
      const endpoint =
        mode === "create" ? "/api/posts" : `/api/posts/${post?.id}`;
      const payload = asDraft != null ? { ...values, draft: asDraft } : values;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getCollectionHeader(activeCollectionId),
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        fieldErrors?: Array<{ path: string; message: string }>;
        post?: BlogPostRecord;
      };

      if (!response.ok) {
        const message = data.error ?? "Save failed.";
        for (const fieldError of data.fieldErrors ?? []) {
          if (
            fieldError.path === "slug" ||
            fieldError.path.startsWith("fieldValues.")
          ) {
            form.setError(fieldError.path as Path<FormValues>, {
              type: "server",
              message: fieldError.message,
            });
          }
        }
        setServerError(message);
        notify.error(message);
        return;
      }

      const successMessage = asDraft
        ? "Moved to draft."
        : mode === "create"
          ? "Draft created."
          : "Changes saved and published.";
      notify.success(successMessage);

      startTransition(() => {
        if (data.post) {
          onPostSaved(data.post, mode);
          return;
        }

        onClose();
      });
    });
  }

  const submitDraft = form.handleSubmit((values) => {
    submitValues(values);
  });

  const submitUnpublish = form.handleSubmit((values) => {
    submitValues(values, true);
  });

  const openPublishConfirmation = form.handleSubmit((values) => {
    if (framerUnavailable) {
      const message = TRANSIENT_FRAMER_EDITOR_MESSAGE;
      setServerError(message);
      notify.error(message);
      return;
    }

    setServerError(null);
    setPendingValues(values);
    setConfirmOpen(true);
  });

  function confirmPublish() {
    if (!pendingValues) {
      return;
    }

    const values = pendingValues;
    setConfirmOpen(false);
    setPendingValues(null);
    submitValues(values);
  }

  function renderField(field: DashboardFieldDefinition) {
    const errorMessage = getFieldErrorMessage(
      form.formState.errors.fieldValues,
      field.id,
    );
    const path = `fieldValues.${field.id}` as const;
    const className = cn(
      fieldClassName,
      (isLongTextField(field) || field.type === "array") && wideFieldClassName,
    );
    const inputId = `field-${field.id}`;
    const currentValue = watchedFieldValues?.[field.id] as
      | string
      | string[]
      | boolean
      | undefined;

    if (field.type === "boolean") {
      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => (
              <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex min-h-[42px] items-center justify-between gap-3 px-3">
                <div className="min-w-0">
                  <Label
                    className="text-sm text-fresco-title"
                    htmlFor={inputId}
                  >
                    Enabled
                  </Label>
                </div>
                <Checkbox
                  checked={controllerField.value === true}
                  id={inputId}
                  onCheckedChange={(checked) => {
                    controllerField.onChange(checked === true);
                  }}
                />
              </div>
            )}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (field.type === "enum") {
      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => {
              const normalizedValue = getNormalizedEnumSelectValue(
                field,
                controllerField.value,
              );
              const selectedValue =
                typeof normalizedValue === "string" &&
                normalizedValue.length > 0
                  ? normalizedValue
                  : field.required
                    ? undefined
                    : EMPTY_SELECT_VALUE;

              return (
                <Select
                  onValueChange={(value) => {
                    controllerField.onChange(
                      !field.required && value === EMPTY_SELECT_VALUE
                        ? ""
                        : value,
                    );
                  }}
                  value={selectedValue}
                >
                  <SelectTrigger className={formControlClassName} id={inputId}>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.required ? null : (
                      <SelectItem value={EMPTY_SELECT_VALUE}>
                        No selection
                      </SelectItem>
                    )}
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (
      field.type === "collectionReference" ||
      field.type === "multiCollectionReference"
    ) {
      const referenceOptions = field.referenceCollection?.options ?? [];

      if (field.type === "multiCollectionReference") {
        const selectedValues = getNormalizedMultiReferenceSelectValues(
          field,
          currentValue,
        );

        return (
          <div className={cn(className, wideFieldClassName)} key={field.id}>
            <div className={labelRowClassName}>
              <FieldLabel name={field.name} required={field.required} />
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge className={metaBadgeClassName} variant="secondary">
                  {selectedValues.length} selected
                </Badge>
              </div>
            </div>
            <div className="grid gap-2.5">
              {referenceOptions.map((option) => {
                const optionId = `${inputId}-${option.slug}`;
                const checked = selectedValues.includes(option.slug);

                return (
                  <div
                    className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex min-h-[42px] items-center justify-between gap-3 px-3"
                    key={option.slug}
                  >
                    <div className="min-w-0">
                      <Label
                        className="text-sm text-fresco-title"
                        htmlFor={optionId}
                      >
                        {option.label}
                      </Label>
                      <div className="text-sm text-fresco-subtitle">
                        {option.slug}
                      </div>
                    </div>
                    <Checkbox
                      checked={checked}
                      id={optionId}
                      onCheckedChange={(nextChecked) => {
                        const nextValue =
                          nextChecked === true
                            ? [...selectedValues, option.slug]
                            : selectedValues.filter(
                                (value) => value !== option.slug,
                              );

                        form.setValue(path, nextValue, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <span className={helperTextClassName}>
              Select the referenced items. Slugs and labels are resolved
              automatically when saving.
            </span>
            {errorMessage ? (
              <span className={fieldErrorClassName}>{errorMessage}</span>
            ) : null}
          </div>
        );
      }

      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => {
              const normalizedValue = getNormalizedReferenceSelectValue(
                field,
                controllerField.value,
              );
              const selectedValue =
                typeof normalizedValue === "string" &&
                normalizedValue.length > 0
                  ? normalizedValue
                  : field.required
                    ? undefined
                    : EMPTY_SELECT_VALUE;

              return (
                <Select
                  onValueChange={(value) => {
                    controllerField.onChange(
                      !field.required && value === EMPTY_SELECT_VALUE
                        ? ""
                        : value,
                    );
                  }}
                  value={selectedValue}
                >
                  <SelectTrigger className={formControlClassName} id={inputId}>
                    <SelectValue
                      placeholder={
                        field.required ? "Select an item" : "No selection"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {field.required ? null : (
                      <SelectItem value={EMPTY_SELECT_VALUE}>
                        No selection
                      </SelectItem>
                    )}
                    {referenceOptions.map((option) => (
                      <SelectItem key={option.slug} value={option.slug}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }}
          />
          <span className={helperTextClassName}>
            Select the referenced item. Slugs and labels are resolved
            automatically when saving.
          </span>
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (field.type === "formattedText") {
      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel name={field.name} required={field.required} />
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => (
              <RichTextInput
                rewriteContext={{
                  title: typeof titleValue === "string" ? titleValue : undefined,
                  slug: form.getValues("slug") || undefined,
                }}
                onChange={controllerField.onChange}
                placeholder={`Write ${field.name.toLowerCase()}`}
                value={
                  typeof controllerField.value === "string"
                    ? controllerField.value
                    : ""
                }
              />
            )}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (field.type === "image" || field.type === "file") {
      const isUploading = pendingUploads[field.id] === true;

      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <AssetFieldValue
            currentValue={currentValue ?? null}
            field={field}
            inputId={inputId}
            isUploading={isUploading}
            onGenerate={() => setAiImageFieldId(field.id)}
            onRemove={() => {
              form.setValue(path, "", {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
            }}
            onResolved={(imageUrl) => {
              form.setValue(path, imageUrl, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
            }}
            onUpload={(event) => {
              void handleAssetUpload(field, path, event);
            }}
            path={path}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    if (isLongTextField(field)) {
      return (
        <div className={className} key={field.id}>
          <div className={labelRowClassName}>
            <FieldLabel
              htmlFor={inputId}
              name={field.name}
              required={field.required}
            />
          </div>
          <Textarea
            className={cn(formControlClassName, "min-h-[160px] resize-y")}
            id={inputId}
            placeholder={field.name}
            rows={field.id === bodyField?.id ? 8 : 4}
            {...form.register(path)}
          />
          {field.helpText ? (
            <span className={helperTextClassName}>{field.helpText}</span>
          ) : null}
          {errorMessage ? (
            <span className={fieldErrorClassName}>{errorMessage}</span>
          ) : null}
        </div>
      );
    }

    return (
      <div className={className} key={field.id}>
        <div className={labelRowClassName}>
          <FieldLabel
            htmlFor={inputId}
            name={field.name}
            required={field.required}
          />
        </div>
        <Input
          className={cn(
            formControlClassName,
            field.id === titleField?.id && titleControlClassName,
          )}
          id={inputId}
          placeholder={field.name}
          type={
            field.type === "number"
              ? "number"
              : field.type === "date"
                ? field.displayTime
                  ? "datetime-local"
                  : "date"
                : "text"
          }
          {...form.register(path)}
        />
        {field.helpText ? (
          <span className={helperTextClassName}>{field.helpText}</span>
        ) : null}
        {errorMessage ? (
          <span className={fieldErrorClassName}>{errorMessage}</span>
        ) : null}
      </div>
    );
  }

  return (
    <section className="flex h-full flex-col bg-fresco-panel">
      <div className="sticky top-0 z-10 border-b border-fresco-divider bg-fresco-panel px-5 py-4 ">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Button
              aria-label="Close editor"
              className="rounded-none border border-fresco-divider bg-fresco-surface-elevated shadow-[inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)] size-10 rounded-lg text-fresco-text"
              onClick={onClose}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <svg
                fill="none"
                height="18"
                viewBox="0 0 18 18"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.5 4.5L13.5 13.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.4"
                />
                <path
                  d="M13.5 4.5L4.5 13.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.4"
                />
              </svg>
            </Button>
            <div
              aria-hidden="true"
              className="hidden h-[34px] w-px bg-fresco-divider sm:block"
            />
            <div className="min-w-0 max-w-[720px]">
              <span className="text-sm font-medium tracking-[0.12em] text-fresco-subtitle">
                {mode === "create" ? "Create Post" : "Edit Post"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 max-md:w-full">
            <Badge
              className={cn(
                "relative h-[34px] rounded-full border px-3 pl-6 text-[11px] font-bold uppercase tracking-[0.08em] before:absolute before:top-1/2 before:left-2.5 before:size-[7px] before:-translate-y-1/2 before:rounded-full before:bg-current",
                form.formState.isDirty
                  ? "border border-fresco-warning-callout-border bg-fresco-warning-callout-bg text-fresco-warning-callout-text"
                  : "border border-[color-mix(in_srgb,var(--color-fresco-tint)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-fresco-tint)_10%,transparent)] text-[color-mix(in_srgb,var(--color-fresco-title)_78%,var(--color-fresco-tint))]",
              )}
              variant="outline"
            >
              {statusLabel}
            </Badge>
            {form.formState.isDirty ? (
              <Button
                disabled={pending || framerUnavailable}
                onClick={resetForm}
                size="lg"
                type="button"
                variant="outline"
              >
                Reset
              </Button>
            ) : null}
            {mode === "edit" && onChatWithItem ? (
              <Button
                className="gap-2"
                disabled={pending || framerUnavailable}
                onClick={onChatWithItem}
                size="lg"
                type="button"
                variant="outline"
              >
                <ChatCircle className="size-4" weight="duotone" />
                Chat with Item
              </Button>
            ) : null}
            {mode === "create" ? (
              <Button
                className={primaryButtonClassName}
                disabled={pending || framerUnavailable}
                onClick={submitDraft}
                size="lg"
                type="button"
              >
                {pending ? "Saving..." : "Create Draft"}
              </Button>
            ) : (
              <>
                {!post?.draft ? (
                  <Button
                    disabled={pending || framerUnavailable}
                    onClick={submitUnpublish}
                    size="lg"
                    type="button"
                    variant="outline"
                  >
                    {pending ? "Saving..." : "Unpublish"}
                  </Button>
                ) : null}
                <Button
                  className={primaryButtonClassName}
                  disabled={
                    pending || framerUnavailable || !form.formState.isDirty
                  }
                  onClick={openPublishConfirmation}
                  size="lg"
                  type="button"
                >
                  {pending ? "Publishing..." : "Publish"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {serverError ? (
        <div className="rounded-none border border-fresco-danger-callout-border bg-fresco-danger-callout-bg px-4 py-3 text-sm text-fresco-danger-callout-text mx-6 mt-4" role="alert">
          {serverError}
        </div>
      ) : null}

      {framerUnavailable ? (
        <div className={cn(warningBannerClassName, "mx-6 mt-4")} role="status">
          Framer Server API is temporarily unavailable. FramerBot is still
          working and your content is safe. You can review cached content here,
          but editing and publishing are disabled until the connection recovers.
        </div>
      ) : null}

      <form
        className="flex flex-1 flex-col gap-4 overflow-auto px-4 pt-5 pb-8 md:px-6 md:pb-10"
        onSubmit={
          mode === "create" ? submitDraft : (event) => event.preventDefault()
        }
      >
        <fieldset className="contents" disabled={framerUnavailable}>
          <div className="flex max-w-[840px] flex-col gap-4">
            {titleField ? renderField(titleField) : null}

            <div className={fieldClassName}>
              <div className={labelRowClassName}>
                <FieldLabel htmlFor="post-slug" name="Slug" required />
              </div>
              <Input
                className={formControlClassName}
                id="post-slug"
                placeholder="my-new-post"
                {...form.register("slug")}
              />
              {form.formState.errors.slug ? (
                <span className={fieldErrorClassName}>
                  {form.formState.errors.slug.message}
                </span>
              ) : null}
            </div>

            {nonContentFields.map((field) => renderField(field))}
            {bodyField && bodyField.id !== titleField?.id
              ? renderField(bodyField)
              : null}
            {contentFields.map((field) => renderField(field))}

            {readOnlyFields.length > 0 ? (
              <section className="rounded-none border border-fresco-divider bg-fresco-surface-subtle mt-2 flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle w-fit">
                    Read Only In Dashboard
                  </span>
                  <p className="text-sm leading-6 text-fresco-description">
                    These fields are still part of the Framer schema but are not
                    editable here.
                  </p>
                </div>
                <div className="flex max-w-[840px] flex-col gap-4">
                  {readOnlyFields.map((field) => (
                    <ReadOnlyField
                      field={field}
                      key={field.id}
                      value={post?.fieldValues[field.id] ?? ""}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </fieldset>
      </form>

      <Dialog
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setPendingValues(null);
          }
        }}
        open={mode === "edit" && confirmOpen}
      >
        <DialogContent
          className="border-fresco-divider bg-fresco-panel text-fresco-title rounded-none border"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle id="publish-confirm-title">
              Publish these changes?
            </DialogTitle>
            <DialogDescription id="publish-confirm-description">
              This will push your edits live in Framer immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-0 -mb-0 flex justify-end gap-2.5 rounded-none border-0 bg-transparent p-0">
            <Button
              disabled={pending || framerUnavailable}
              onClick={() => {
                setConfirmOpen(false);
                setPendingValues(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className={primaryButtonClassName}
              disabled={pending || framerUnavailable}
              onClick={confirmPublish}
              type="button"
            >
              {pending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Image Generation Dialog — image fields */}
      <AIImageDialog
        context={{
          title: typeof titleValue === "string" ? titleValue : undefined,
          slug: form.getValues("slug") || undefined,
        }}
        defaultPrompt=""
        onAccept={(imageUrl) => {
          if (aiImageFieldId) {
            const fieldPath = `fieldValues.${aiImageFieldId}` as const;
            form.setValue(fieldPath, imageUrl, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
            notify.success("AI image applied.");
          }
        }}
        onOpenChange={(open) => {
          if (!open) setAiImageFieldId(null);
        }}
        open={aiImageFieldId !== null}
        referenceImageUrl={
          aiImageFieldId &&
          typeof watchedFieldValues?.[aiImageFieldId] === "string" &&
          (watchedFieldValues[aiImageFieldId] as string).length > 0 &&
          !extractImageJobId(watchedFieldValues[aiImageFieldId] as string)
            ? (watchedFieldValues[aiImageFieldId] as string)
            : undefined
        }
      />

    </section>
  );
}
