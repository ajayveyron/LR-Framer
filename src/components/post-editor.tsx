"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { buildPostInputSchema, type PostInputPayload } from "@/lib/post-schema";

type FormValues = PostInputPayload;
const EMPTY_SELECT_VALUE = "__none__";

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toEditorHtml(value: string) {
  if (!value) {
    return "";
  }

  if (looksLikeHtml(value)) {
    return value;
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br />");

      return `<p>${lines || "<br />"}</p>`;
    })
    .join("");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  return field.type === "string" &&
    (field.logicalKey === "body" || /description|summary|excerpt/i.test(field.name));
}

function ReadOnlyField({
  field,
  value,
}: {
  field: DashboardFieldDefinition;
  value: DashboardFieldValue;
}) {
  return (
    <div className="editor-field editor-field-wide editor-field-readonly">
      <div className="editor-label-row">
        <Label>{field.name}</Label>
        <Badge className="required-badge" variant="outline">Read only</Badge>
      </div>
      <div className="warning-banner">
        {field.helpText ?? "This field type is visible but not editable in the dashboard."}
      </div>
      <div className="editor-readonly-value mono">
        {Array.isArray(value) ? value.join(", ") : String(value ?? "")}
      </div>
    </div>
  );
}

function RichTextInput({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextHtml = toEditorHtml(value);
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [value]);

  function syncValue() {
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function applyCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      applyCommand("bold");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      applyCommand("italic");
    }
  }

  return (
    <div className="rich-text-shell">
      <div className="rich-text-toolbar">
        <Button
          onMouseDown={(event) => {
            event.preventDefault();
            applyCommand("bold");
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          Bold
        </Button>
        <Button
          onMouseDown={(event) => {
            event.preventDefault();
            applyCommand("italic");
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          Italic
        </Button>
        <Button
          onMouseDown={(event) => {
            event.preventDefault();
            applyCommand("formatBlock", "<h2>");
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          H2
        </Button>
        <Button
          onMouseDown={(event) => {
            event.preventDefault();
            applyCommand("insertUnorderedList");
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          List
        </Button>
        <Button
          onMouseDown={(event) => {
            event.preventDefault();
            applyCommand("formatBlock", "<blockquote>");
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          Quote
        </Button>
      </div>
      <div
        className="rich-text-editor"
        contentEditable
        data-placeholder={placeholder}
        onBlur={syncValue}
        onInput={syncValue}
        onKeyDown={handleKeyDown}
        ref={editorRef}
        suppressContentEditableWarning
      />
    </div>
  );
}

export function PostEditor({
  metadata,
  mode,
  post,
}: {
  metadata: BlogCollectionMetadata;
  mode: "create" | "edit";
  post: BlogPostRecord | null;
}) {
  const router = useRouter();
  const notify = useNotify();
  const [pending, startSaving] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [pendingUploads, setPendingUploads] = useState<Record<string, boolean>>({});
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
  const slugValue = useWatch({
    control: form.control,
    name: "slug",
  });
  const titleValue = titleFieldId ? watchedFieldValues?.[titleFieldId] : undefined;
  const supportedFields = metadata.fields.filter((field) => field.supported);
  const readOnlyFields = metadata.fields.filter((field) => !field.supported);
  const titleField = titleFieldId
    ? supportedFields.find((field) => field.id === titleFieldId)
    : undefined;
  const bodyField = bodyFieldId
    ? supportedFields.find((field) => field.id === bodyFieldId)
    : undefined;
  const remainingFields = supportedFields.filter((field) =>
    field.id !== titleField?.id && field.id !== bodyField?.id
  );
  const nonContentFields = remainingFields.filter((field) =>
    field.type !== "formattedText" && field.logicalKey !== "body"
  );
  const contentFields = remainingFields.filter((field) =>
    field.type === "formattedText" || field.logicalKey === "body"
  );
  const drawerTitle =
    typeof titleValue === "string" && titleValue.trim().length > 0
      ? titleValue.trim()
      : mode === "create"
        ? "Untitled Draft"
        : post?.title ?? post?.slug ?? "Untitled Entry";
  const statusLabel = mode === "create"
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

  function submitValues(values: FormValues) {
    setServerError(null);
    form.clearErrors();

    startSaving(async () => {
      const endpoint = mode === "create" ? "/api/posts" : `/api/posts/${post?.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as {
        error?: string;
        fieldErrors?: Array<{ path: string; message: string }>;
        post?: BlogPostRecord;
      };

      if (!response.ok) {
        const message = data.error ?? "Save failed.";
        for (const fieldError of data.fieldErrors ?? []) {
          if (fieldError.path === "slug" || fieldError.path.startsWith("fieldValues.")) {
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

      notify.success(
        mode === "create" ? "Draft created." : "Changes saved and published.",
      );

      startTransition(() => {
        router.replace(`/posts/${data.post?.id ?? post?.id}`);
        router.refresh();
      });
    });
  }

  const submitDraft = form.handleSubmit((values) => {
    submitValues(values);
  });

  const openPublishConfirmation = form.handleSubmit((values) => {
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
    const className = isLongTextField(field) || field.type === "array"
      ? "editor-field editor-field-wide"
      : "editor-field";
    const inputId = `field-${field.id}`;
    const currentValue = watchedFieldValues?.[field.id] as
      | string
      | string[]
      | boolean
      | undefined;

    if (field.type === "boolean") {
      return (
        <div className={className} key={field.id}>
          <div className="editor-label-row">
            <Label htmlFor={inputId}>{field.name}</Label>
            {field.required ? (
              <Badge className="required-badge" variant="outline">Required</Badge>
            ) : null}
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => (
              <div className="checkbox-row">
                <div className="editor-reference-copy">
                  <Label className="text-sm text-white/86" htmlFor={inputId}>Enabled</Label>
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
          {field.helpText ? <span className="helper-text">{field.helpText}</span> : null}
          {errorMessage ? <span className="field-error">{errorMessage}</span> : null}
        </div>
      );
    }

    if (field.type === "enum") {
      return (
        <div className={className} key={field.id}>
          <div className="editor-label-row">
            <Label htmlFor={inputId}>{field.name}</Label>
            {field.required ? (
              <Badge className="required-badge" variant="outline">Required</Badge>
            ) : null}
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => (
              <Select
                onValueChange={(value) => {
                  controllerField.onChange(value === EMPTY_SELECT_VALUE ? "" : value);
                }}
                value={
                  typeof controllerField.value === "string" && controllerField.value.length > 0
                    ? controllerField.value
                    : EMPTY_SELECT_VALUE
                }
              >
                <SelectTrigger className="editor-select-trigger" id={inputId}>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>Select an option</SelectItem>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {field.helpText ? <span className="helper-text">{field.helpText}</span> : null}
          {errorMessage ? <span className="field-error">{errorMessage}</span> : null}
        </div>
      );
    }

    if (
      field.type === "collectionReference" ||
      field.type === "multiCollectionReference"
    ) {
      const referenceOptions = field.referenceCollection?.options ?? [];

      if (field.type === "multiCollectionReference") {
        const selectedValues = Array.isArray(currentValue) ? currentValue : [];

        return (
          <div className={`${className} editor-field-wide`} key={field.id}>
            <div className="editor-label-row">
              <Label>{field.name}</Label>
              <div className="editor-toolbar-actions">
                {field.required ? (
                  <Badge className="required-badge" variant="outline">Required</Badge>
                ) : null}
                <Badge className="required-badge" variant="secondary">
                  {selectedValues.length} selected
                </Badge>
              </div>
            </div>
            <div className="editor-reference-list">
              {referenceOptions.map((option) => {
                const optionId = `${inputId}-${option.slug}`;
                const checked = selectedValues.includes(option.slug);

                return (
                  <div className="checkbox-row editor-reference-option" key={option.slug}>
                    <div className="editor-reference-copy">
                      <Label className="text-sm text-white/86" htmlFor={optionId}>
                        {option.label}
                      </Label>
                      <div className="mono muted">{option.slug}</div>
                    </div>
                    <Checkbox
                      checked={checked}
                      id={optionId}
                      onCheckedChange={(nextChecked) => {
                        const nextValue = nextChecked === true
                          ? [...selectedValues, option.slug]
                          : selectedValues.filter((value) => value !== option.slug);

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
            <span className="helper-text">
              Select the referenced items. Slugs and labels are resolved automatically
              when saving.
            </span>
            {errorMessage ? <span className="field-error">{errorMessage}</span> : null}
          </div>
        );
      }

      return (
        <div className={className} key={field.id}>
          <div className="editor-label-row">
            <Label htmlFor={inputId}>{field.name}</Label>
            {field.required ? (
              <Badge className="required-badge" variant="outline">Required</Badge>
            ) : null}
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => (
              <Select
                onValueChange={(value) => {
                  controllerField.onChange(value === EMPTY_SELECT_VALUE ? "" : value);
                }}
                value={
                  typeof controllerField.value === "string" && controllerField.value.length > 0
                    ? controllerField.value
                    : EMPTY_SELECT_VALUE
                }
              >
                <SelectTrigger className="editor-select-trigger" id={inputId}>
                  <SelectValue placeholder="No selection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>No selection</SelectItem>
                  {referenceOptions.map((option) => (
                    <SelectItem key={option.slug} value={option.slug}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <span className="helper-text">
            Select the referenced item. Slugs and labels are resolved automatically when
            saving.
          </span>
          {errorMessage ? <span className="field-error">{errorMessage}</span> : null}
        </div>
      );
    }

    if (field.type === "formattedText") {
      return (
        <div className={className} key={field.id}>
          <div className="editor-label-row">
            <Label>{field.name}</Label>
            {field.required ? (
              <Badge className="required-badge" variant="outline">Required</Badge>
            ) : null}
          </div>
          <Controller
            control={form.control}
            name={path}
            render={({ field: controllerField }) => (
              <RichTextInput
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
          {field.helpText ? <span className="helper-text">{field.helpText}</span> : null}
          {errorMessage ? <span className="field-error">{errorMessage}</span> : null}
        </div>
      );
    }

    if (field.type === "image" || field.type === "file") {
      const assetUrl = typeof currentValue === "string" ? currentValue : "";
      const isUploading = pendingUploads[field.id] === true;
      const uploadId = `${inputId}-upload`;

      return (
        <div className={className} key={field.id}>
          <div className="editor-label-row">
            <Label htmlFor={inputId}>{field.name}</Label>
            {field.required ? (
              <Badge className="required-badge" variant="outline">Required</Badge>
            ) : null}
          </div>
          <div className="editor-asset-field">
            {assetUrl ? (
              <div className="editor-asset-preview">
                {field.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={field.name} src={assetUrl} />
                ) : (
                  <div className="editor-file-icon" aria-hidden="true">
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
                      <path d="M12 2.75V7.25H16.5" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </div>
                )}
                <div className="stack" style={{ gap: 2 }}>
                  <strong>{getAssetLabel(assetUrl)}</strong>
                  <span className="muted">
                    {field.type === "image" ? "Image asset" : "File asset"}
                  </span>
                </div>
              </div>
            ) : (
              <Input
                className="editor-input"
                id={inputId}
                placeholder={field.name}
                {...form.register(path)}
              />
            )}
            <div className="editor-asset-actions">
              <Button asChild className="editor-upload-button" size="sm" variant="outline">
                <label htmlFor={uploadId}>
                  <input
                    accept={field.type === "image" ? "image/*" : undefined}
                    hidden
                    id={uploadId}
                    onChange={(event) => {
                      void handleAssetUpload(field, path, event);
                    }}
                    type="file"
                  />
                  {isUploading ? "Uploading..." : assetUrl ? "Replace" : "Upload"}
                </label>
              </Button>
              {assetUrl ? (
                <Button
                  onClick={() => {
                    form.setValue(path, "", {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          {field.helpText ? <span className="helper-text">{field.helpText}</span> : null}
          {errorMessage ? <span className="field-error">{errorMessage}</span> : null}
        </div>
      );
    }

    if (isLongTextField(field)) {
      return (
        <div className={className} key={field.id}>
          <div className="editor-label-row">
            <Label htmlFor={inputId}>{field.name}</Label>
            {field.required ? (
              <Badge className="required-badge" variant="outline">Required</Badge>
            ) : null}
          </div>
          <Textarea
            className="editor-textarea"
            id={inputId}
            placeholder={field.name}
            rows={field.id === bodyField?.id ? 8 : 4}
            {...form.register(path)}
          />
          {field.helpText ? <span className="helper-text">{field.helpText}</span> : null}
          {errorMessage ? <span className="field-error">{errorMessage}</span> : null}
        </div>
      );
    }

    return (
      <div className={className} key={field.id}>
        <div className="editor-label-row">
          <Label htmlFor={inputId}>{field.name}</Label>
          {field.required ? (
            <Badge className="required-badge" variant="outline">Required</Badge>
          ) : null}
        </div>
        <Input
          className={field.id === titleField?.id ? "editor-input editor-input-title" : "editor-input"}
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
        {field.helpText ? <span className="helper-text">{field.helpText}</span> : null}
        {errorMessage ? <span className="field-error">{errorMessage}</span> : null}
      </div>
    );
  }

  return (
    <section className="editor-drawer">
      <div className="editor-header">
        <div className="editor-header-main">
          <div className="editor-nav">
            <Button asChild className="editor-icon-button" size="icon-sm" variant="outline">
              <Link aria-label="Close editor" href="/">
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
              </Link>
            </Button>
            <div className="editor-nav-divider" aria-hidden="true" />
            <div className="editor-nav-copy">
              <span className="eyebrow">
                {mode === "create" ? "Create Post" : "Edit Post"}
              </span>
              <h2>{drawerTitle}</h2>
            </div>
          </div>

          <div className="editor-toolbar-actions">
            <Badge
              className={`editor-status-pill ${
                form.formState.isDirty ? "editor-status-pill-alert" : "editor-status-pill-muted"
              }`}
              variant="outline"
            >
              {statusLabel}
            </Badge>
            <Button
              disabled={pending || !form.formState.isDirty}
              onClick={resetForm}
              size="sm"
              type="button"
              variant="outline"
            >
              Reset
            </Button>
            {mode === "create" ? (
              <Button
                className="bg-[#0d99ff] text-white hover:bg-[#24a3ff]"
                disabled={pending}
                onClick={submitDraft}
                size="sm"
                type="button"
              >
                {pending ? "Saving..." : "Create Draft"}
              </Button>
            ) : (
              <Button
                className="bg-[#0d99ff] text-white hover:bg-[#24a3ff]"
                disabled={pending}
                onClick={openPublishConfirmation}
                size="sm"
                type="button"
              >
                {pending ? "Publishing..." : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {serverError ? <div className="error-banner" role="alert">{serverError}</div> : null}

      <form
        className="editor-form"
        onSubmit={mode === "create" ? submitDraft : (event) => event.preventDefault()}
      >
        <div className="editor-field-list">
          {titleField ? renderField(titleField) : null}

          <div className="editor-field">
            <div className="editor-label-row">
              <Label htmlFor="post-slug">Slug</Label>
              <Badge className="required-badge" variant="outline">Required</Badge>
            </div>
            <Input
              className="editor-input"
              id="post-slug"
              placeholder="my-new-post"
              {...form.register("slug")}
            />
            <div className="editor-slug-preview mono">
              <span className="editor-slug-icon" aria-hidden="true">
                <svg
                  fill="none"
                  height="14"
                  viewBox="0 0 14 14"
                  width="14"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1.5 7H12.5" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M7 1.5C8.65685 3.08081 9.5 5.05025 9.5 7C9.5 8.94975 8.65685 10.9192 7 12.5C5.34315 10.9192 4.5 8.94975 4.5 7C4.5 5.05025 5.34315 3.08081 7 1.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              </span>
              <span>{slugValue ? `/blog/${slugValue}` : "/blog/your-slug"}</span>
            </div>
            {form.formState.errors.slug ? (
              <span className="field-error">{form.formState.errors.slug.message}</span>
            ) : null}
          </div>

          {nonContentFields.map((field) => renderField(field))}
          {bodyField && bodyField.id !== titleField?.id ? renderField(bodyField) : null}
          {contentFields.map((field) => renderField(field))}

          {readOnlyFields.length > 0 ? (
            <section className="editor-readonly-group">
              <div className="stack" style={{ gap: 6 }}>
                <span className="eyebrow">Read Only In Dashboard</span>
                <p className="muted">
                  These fields are still part of the Framer schema but are not editable here.
                </p>
              </div>
              <div className="editor-field-list">
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
        <DialogContent className="modal-card" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle id="publish-confirm-title">Publish these changes?</DialogTitle>
            <DialogDescription id="publish-confirm-description">
              This will push your edits live in Framer immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="modal-actions -mx-0 -mb-0 rounded-none border-0 bg-transparent p-0">
            <Button
              disabled={pending}
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
              className="bg-[#0d99ff] text-white hover:bg-[#24a3ff]"
              disabled={pending}
              onClick={confirmPublish}
              type="button"
            >
              {pending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
