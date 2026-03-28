"use client";

import {
  CheckCircle,
  Database,
  DownloadSimple,
  GlobeSimple,
  ImageSquare,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";

import { AsyncImageCard } from "@/components/async-image-card";
import { CmsActionConfirmation } from "@/components/cms-action-confirmation";
import { EditProposalView } from "@/components/edit-proposal-view";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
} from "@/components/ai-elements/chain-of-thought";
import { MessageResponse } from "@/components/ai-elements/message";
import { ToolCallRow } from "@/components/ai-elements/tool";
import {
  renderFramerToolOutput,
  type FieldNameMap,
  type FieldTypeMap,
} from "@/components/ai-tool-renderers";
import type { CmsActionProposal } from "@/lib/cms-action-types";
import type { BlogCollectionMetadata, BlogPostRecord } from "@/lib/cms-types";
import { parseEditProposals } from "@/lib/ai-edit-parser";
import type { BulkApplyResult } from "@/lib/ai-bulk-apply";
import type { AIChatMessage } from "@/lib/ai-chat-types";

function stripHtmlPreview(value: string, maxLength = 220) {
  const plain = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength).trimEnd()}…`;
}

function getPartialFieldString(
  fieldData: unknown,
  fieldNames: FieldNameMap,
  matcher: (label: string) => boolean,
) {
  if (!fieldData || typeof fieldData !== "object") {
    return null;
  }

  for (const [fieldId, entry] of Object.entries(
    fieldData as Record<string, { value?: unknown }>,
  )) {
    const label = (fieldNames[fieldId] ?? fieldId).toLowerCase();
    if (!matcher(label)) {
      continue;
    }

    const value = entry?.value;
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function PartialCmsProposalPreview({
  input,
  fieldNames,
  rawInputText,
  timingMeta,
}: {
  input: unknown;
  fieldNames: FieldNameMap;
  rawInputText?: string | null;
  timingMeta?: string | null;
}) {
  const proposal =
    input && typeof input === "object"
      ? (input as {
          description?: unknown;
          payload?: {
            action?: unknown;
            items?: Array<{
              slug?: unknown;
              fieldData?: unknown;
            }>;
          };
        })
      : null;

  const description =
    typeof proposal?.description === "string" ? proposal.description : null;
  const action =
    typeof proposal?.payload?.action === "string"
      ? proposal.payload.action
      : null;
  const items = Array.isArray(proposal?.payload?.items)
    ? proposal.payload.items
    : [];

  const visibleItems = items
    .map((item, index) => {
      const title =
        getPartialFieldString(
          item?.fieldData,
          fieldNames,
          (label) => label.includes("title"),
        ) ??
        (typeof item?.slug === "string" && item.slug.trim().length > 0
          ? item.slug
          : `Draft ${index + 1}`);

      const descriptionText = getPartialFieldString(
        item?.fieldData,
        fieldNames,
        (label) =>
          label.includes("description") ||
          label.includes("summary") ||
          label.includes("excerpt"),
      );

      const bodyText = getPartialFieldString(
        item?.fieldData,
        fieldNames,
        (label) =>
          label.includes("content") ||
          label.includes("body") ||
          label.includes("article"),
      );

      return {
        title,
        descriptionText,
        bodyPreview: bodyText ? stripHtmlPreview(bodyText, 280) : null,
      };
    })
    .filter((item) => item.title || item.descriptionText || item.bodyPreview);

  const summary =
    description ??
    (action === "add_items"
      ? `Streaming ${items.length} draft item${items.length === 1 ? "" : "s"} into the CMS proposal.`
      : "Streaming the CMS action payload.");

  return (
    <ToolCallRow
      elevated
      icon={<Database className="size-3.5" weight="fill" />}
      label={
        action === "add_items"
          ? `Assembling ${items.length || ""} draft${items.length === 1 ? "" : "s"}`
          : "Assembling CMS action"
      }
      status="Streaming"
      summary={summary}
      tone="accent"
      shimmer
    >
      {visibleItems.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-fresco-divider/60">
          {visibleItems.slice(0, 10).map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className={
                index === 0
                  ? "px-3 py-2.5"
                  : "border-t border-fresco-divider/60 px-3 py-2.5"
              }
            >
              <div className="text-[12px] font-medium text-fresco-title">
                {item.title}
              </div>
              {item.descriptionText ? (
                <div className="mt-0.5 text-[11px] leading-relaxed text-fresco-subtitle">
                  {item.descriptionText}
                </div>
              ) : null}
              {item.bodyPreview ? (
                <div className="mt-1.5 text-[11px] leading-relaxed text-fresco-description">
                  {item.bodyPreview}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] leading-relaxed text-fresco-description">
          Waiting for the first draft fields to stream in.
        </div>
      )}
      {!visibleItems.length && rawInputText ? (
        <div className="overflow-hidden rounded-xl border border-fresco-divider/60 bg-fresco-surface-subtle/70">
          <div className="border-b border-fresco-divider/60 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-fresco-subtitle">
            Raw tool input stream
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-[11px] leading-relaxed text-fresco-description">
            {rawInputText}
          </pre>
        </div>
      ) : null}
      {timingMeta ? (
        <div className="text-[10px] text-fresco-subtitle">{timingMeta}</div>
      ) : null}
    </ToolCallRow>
  );
}

function FramerToolGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="33 23 75 97"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 44.65 33.992 L 95.35 33.992 L 95.35 59.341 L 70 59.341 Z M 44.65 59.341 L 70 59.341 L 95.35 84.691 L 44.65 84.691 Z M 44.65 84.691 L 70 84.691 L 70 110.041 Z"
        fill="currentColor"
      />
    </svg>
  );
}

const TOOL_LABELS: Record<string, string> = {
  framer_get_publish_info: "Load publish settings",
  framer_get_collections: "Load collections",
  framer_get_collection_fields: "Load collection fields",
  framer_get_collection_items: "Load collection items",
  framer_get_enum_cases: "Load field options",
  framer_get_item_by_id: "Load item details",
  framer_get_item_by_slug: "Load item details",
  framer_create_item: "Create item",
  framer_update_item: "Update item",
  framer_delete_item: "Delete item",
  framer_publish_site: "Publish site",
  framer_upload_asset: "Upload asset",
  save_preference: "Save preference",
};

function formatToolName(rawToolName: string) {
  return (
    TOOL_LABELS[rawToolName] ??
    rawToolName.replace(/^framer_/, "").replace(/_/g, " ")
  );
}

const TOOL_SUMMARIES: Record<
  string,
  {
    done: string;
    running: string;
    stopped?: string;
  }
> = {
  framer_get_publish_info: {
    done: "Loaded publish settings",
    running: "Loading publish settings…",
    stopped: "Stopped loading publish settings",
  },
  framer_get_collections: {
    done: "Loaded collections",
    running: "Loading collections…",
    stopped: "Stopped loading collections",
  },
  framer_get_collection_fields: {
    done: "Loaded collection fields",
    running: "Loading collection fields…",
    stopped: "Stopped loading collection fields",
  },
  framer_get_collection_items: {
    done: "Loaded collection items",
    running: "Loading collection items…",
    stopped: "Stopped loading collection items",
  },
  framer_get_enum_cases: {
    done: "Loaded field options",
    running: "Loading field options…",
    stopped: "Stopped loading field options",
  },
  framer_get_item_by_id: {
    done: "Loaded item details",
    running: "Loading item details…",
    stopped: "Stopped loading item details",
  },
  framer_get_item_by_slug: {
    done: "Loaded item details",
    running: "Loading item details…",
    stopped: "Stopped loading item details",
  },
  framer_create_item: {
    done: "Created item",
    running: "Creating item…",
    stopped: "Stopped creating item",
  },
  framer_update_item: {
    done: "Updated item",
    running: "Updating item…",
    stopped: "Stopped updating item",
  },
  framer_delete_item: {
    done: "Deleted item",
    running: "Deleting item…",
    stopped: "Stopped deleting item",
  },
  framer_publish_site: {
    done: "Published site",
    running: "Publishing site…",
    stopped: "Stopped publishing site",
  },
  framer_upload_asset: {
    done: "Uploaded asset",
    running: "Uploading asset…",
    stopped: "Stopped uploading asset",
  },
  save_preference: {
    done: "Saved preference",
    running: "Saving preference…",
    stopped: "Stopped saving preference",
  },
};

function getToolSummary(rawToolName: string, state: "done" | "running" | "stopped") {
  const mapped = TOOL_SUMMARIES[rawToolName];
  if (mapped) {
    return mapped[state] ?? mapped.running;
  }

  const base = formatToolName(rawToolName).toLowerCase();
  if (state === "done") {
    return `${base[0].toUpperCase()}${base.slice(1)} finished`;
  }
  if (state === "stopped") {
    return `Stopped ${base}`;
  }
  return `${base[0].toUpperCase()}${base.slice(1)}…`;
}

function getToolRunState(
  part: AIChatMessage["parts"][number],
  isLastMessage: boolean,
  isStreaming: boolean,
) {
  const hasOutput = "output" in part && part.output != null;
  const hasError =
    "errorText" in part && typeof (part as any).errorText === "string";
  const state =
    "state" in part && typeof (part as any).state === "string"
      ? ((part as any).state as string)
      : null;

  const isActivelyRunning =
    !hasOutput &&
    !hasError &&
    isLastMessage &&
    isStreaming &&
    (!state ||
      state === "input-available" ||
      state === "input-streaming" ||
      state === "partial-call" ||
      state === "call");

  return {
    hasError,
    hasOutput,
    isActivelyRunning,
    isStale: !hasOutput && !hasError && !isActivelyRunning,
    state,
  };
}

interface AIMessagePartRendererProps {
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
  allFieldNames: FieldNameMap;
  allFieldTypes: FieldTypeMap;
  getToolTimingMeta: (toolCallId?: string | null) => string | null;
  handleApplied: (result: BulkApplyResult) => void;
  isLastMessage: boolean;
  isStreaming: boolean;
  lastCmsActionIdx: number;
  metadata: BlogCollectionMetadata;
  onPreviewPost: (post: BlogPostRecord | null) => void;
  part: AIChatMessage["parts"][number];
  partIndex: number;
  rawToolInputs: Record<string, { text: string; toolName?: string | null }>;
  selectedPosts: BlogPostRecord[];
}

export function AIMessagePartRenderer({
  addToolApprovalResponse,
  allFieldNames,
  allFieldTypes,
  getToolTimingMeta,
  handleApplied,
  isLastMessage,
  isStreaming,
  lastCmsActionIdx,
  metadata,
  onPreviewPost,
  part,
  partIndex,
  rawToolInputs,
  selectedPosts,
}: AIMessagePartRendererProps) {
  if (part.type === "file") {
    const isImage = part.mediaType?.startsWith("image/");
    if (isImage) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={part.filename ?? "Attached image"}
          className="max-h-48 rounded-xl border border-fresco-divider/70 object-contain"
          src={part.url}
        />
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 rounded-xl border border-fresco-divider/70 bg-fresco-surface-muted/80 px-2.5 py-1.5 text-xs text-fresco-description">
        <ImageSquare className="size-3.5 shrink-0" weight="fill" />
        <span className="max-w-40 truncate">
          {part.filename ?? "Attachment"}
        </span>
      </div>
    );
  }

  if (part.type === "text" && part.text.length > 0) {
    return (
      <MessageResponse isAnimating={isLastMessage && isStreaming}>
        {part.text}
      </MessageResponse>
    );
  }

  if (part.type === "reasoning") {
    const reasoningPart = part as {
      state?: string;
      text?: string;
      type: "reasoning";
    };
    const text = reasoningPart.text ?? "";
    const thinking =
      reasoningPart.state !== "complete" && isLastMessage && isStreaming;

    if (!text && !thinking) {
      return null;
    }

    return (
      <ChainOfThought streaming={thinking} defaultOpen={thinking}>
        <ChainOfThoughtHeader>
          {thinking ? undefined : "Reasoning"}
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent>{text || "Thinking…"}</ChainOfThoughtContent>
      </ChainOfThought>
    );
  }

  if (part.type === "tool-propose_edits") {
    const toolData =
      "output" in part && part.output ? part.output : part.input;
    if (!toolData) {
      return null;
    }

    const edits = parseEditProposals(toolData);
    if (edits.length === 0) {
      return null;
    }

    return (
      <EditProposalView
        edits={edits}
        fieldDefinitions={metadata.fields.filter((field) => field.supported)}
        onApplied={handleApplied}
        posts={selectedPosts}
      />
    );
  }

  if (part.type === "tool-propose_cms_action") {
    if (partIndex !== lastCmsActionIdx) {
      return null;
    }

    const input = "input" in part ? (part.input as CmsActionProposal) : null;
    const state =
      "state" in part ? ((part as any).state as string | undefined) : undefined;
    const toolCallId =
      "toolCallId" in part && typeof (part as any).toolCallId === "string"
        ? ((part as any).toolCallId as string)
        : null;
    const rawInputText = toolCallId ? rawToolInputs[toolCallId]?.text : null;
    const timingMeta = getToolTimingMeta(toolCallId);

    if (!input?.payload || !input?.description) {
      if (
        state === "input-streaming" ||
        state === "partial-call" ||
        state === "call"
      ) {
        return (
          <PartialCmsProposalPreview
            fieldNames={allFieldNames}
            input={"input" in part ? part.input : null}
            rawInputText={rawInputText}
            timingMeta={timingMeta}
          />
        );
      }
      return null;
    }

    return (
      <CmsActionConfirmation
        fieldNames={allFieldNames}
        metadata={metadata}
        onApprove={() => {
          if ("approval" in part && (part as any).approval?.id) {
            addToolApprovalResponse({
              id: (part as any).approval.id,
              approved: true,
            });
          }
        }}
        onPreviewItem={onPreviewPost}
        onReject={() => {
          if ("approval" in part && (part as any).approval?.id) {
            addToolApprovalResponse({
              id: (part as any).approval.id,
              approved: false,
            });
          }
        }}
        output={"output" in part ? part.output : undefined}
        proposal={input}
        state={state}
      />
    );
  }

  if (part.type === "source-url" || part.type === "source-document") {
    return null;
  }

  if (part.type === "tool-get_project_context") {
    const toolCallId =
      "toolCallId" in part && typeof (part as any).toolCallId === "string"
        ? ((part as any).toolCallId as string)
        : null;
    const { hasOutput, hasError, isActivelyRunning, isStale } =
      getToolRunState(part, isLastMessage, isStreaming);

    return (
      <ToolCallRow
        icon={<Database className="size-3.5" weight="fill" />}
        label="Load project context"
        loading={isActivelyRunning}
        meta={getToolTimingMeta(toolCallId)}
        summaryOnly
        shimmer={isActivelyRunning}
        status={hasError ? "Error" : hasOutput ? "Done" : isStale ? "Stopped" : "Running"}
        summary={
          hasError
            ? (part as any).errorText
            : hasOutput
              ? "Project context loaded"
              : isStale
                ? "Stopped loading project context"
                : "Loading project context…"
        }
        tone={hasError ? "danger" : hasOutput ? "success" : isStale ? "warning" : "accent"}
      />
    );
  }

  if (part.type === "tool-generate_and_upload_image") {
    const { hasOutput, hasError, isActivelyRunning, isStale } =
      getToolRunState(part, isLastMessage, isStreaming);
    const output = hasOutput
      ? (part.output as {
          async?: boolean;
          error?: string;
          jobId?: string;
          prompt?: string;
          success?: boolean;
          url?: string;
        })
      : null;

    if (hasError) {
      return (
        <ToolCallRow
          icon={<ImageSquare className="size-3.5" weight="fill" />}
          label="Generate image"
          summaryOnly
          status="Error"
          summary={(part as any).errorText}
          tone="danger"
        />
      );
    }

    if (output?.async && output?.jobId) {
      return (
        <AsyncImageCard
          jobId={output.jobId}
          prompt={output.prompt ?? "AI generated image"}
        />
      );
    }

    if (!hasOutput) {
      return (
        <ToolCallRow
          icon={<ImageSquare className="size-3.5" weight="fill" />}
          label="Generate image"
          loading={isActivelyRunning}
          summaryOnly
          shimmer={isActivelyRunning}
          status={isStale ? "Stopped" : "Running"}
          summary={isStale ? "Stopped generating image" : "Generating image…"}
          tone={isStale ? "warning" : "accent"}
        />
      );
    }

    if (output?.success && output?.url) {
      return (
        <ToolCallRow
          actions={
            <a
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-fresco-tint transition-colors hover:bg-fresco-divider/70"
              download="ai-generated-image.png"
              href={output.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <DownloadSimple className="size-3.5" weight="bold" />
              <span>Download</span>
            </a>
          }
          icon={<ImageSquare className="size-3.5" weight="fill" />}
          label="Generate image"
          summaryOnly
          status="Done"
          summary="Image generated"
          tone="success"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={output.prompt ?? "AI generated image"}
            className="max-h-64 rounded-xl border border-fresco-divider/70 object-contain"
            src={output.url}
          />
        </ToolCallRow>
      );
    }

    return (
      <ToolCallRow
        icon={<ImageSquare className="size-3.5" weight="fill" />}
        label="Generate image"
        summaryOnly
        status="Error"
        summary={output?.error ?? "Image generation failed"}
        tone="danger"
      />
    );
  }

  if (part.type === "tool-google_search") {
    return null;
  }

  if (part.type === "tool-web_search") {
    const { hasOutput, hasError, isActivelyRunning, isStale } =
      getToolRunState(part, isLastMessage, isStreaming);
    const output = hasOutput
      ? (part.output as {
          answer?: string;
          sources?: Array<{ title: string; url: string }>;
        })
      : null;

    return (
      <ToolCallRow
        icon={<GlobeSimple className="size-3.5" weight="fill" />}
        label="Web search"
        loading={isActivelyRunning}
        summaryOnly
        shimmer={isActivelyRunning}
        status={hasError ? "Error" : hasOutput ? "Done" : isStale ? "Stopped" : "Running"}
        summary={
          hasError
            ? (part as any).errorText
            : hasOutput
              ? "Web search complete"
              : isStale
                ? "Stopped searching the web"
                : "Searching the web…"
        }
        tone={hasError ? "danger" : hasOutput ? "success" : isStale ? "warning" : "accent"}
      >
        {output?.sources && output.sources.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {output.sources.map((source, sourceIndex) => (
              <a
                key={sourceIndex}
                className="inline-flex max-w-48 items-center truncate rounded-full border border-fresco-divider/70 bg-fresco-surface-muted/70 px-2.5 py-1 text-[10px] text-fresco-tint transition-colors hover:bg-fresco-divider/70"
                href={source.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {source.title || new URL(source.url).hostname}
              </a>
            ))}
          </div>
        ) : null}
      </ToolCallRow>
    );
  }

  if (part.type.startsWith("tool-")) {
    const rawToolName = part.type.slice("tool-".length);
    const toolName = formatToolName(rawToolName);
    const { hasOutput, hasError, isActivelyRunning, isStale } =
      getToolRunState(part, isLastMessage, isStreaming);
    const isFramerTool = rawToolName.startsWith("framer_");
    const tone = hasError
      ? "danger"
      : hasOutput
        ? "success"
        : isStale
          ? "warning"
          : "accent";
    const statusLabel = hasError
      ? "Error"
      : hasOutput
        ? "Done"
        : isStale
          ? "Stopped"
          : "Running";
    const toolIcon = isFramerTool ? (
      <FramerToolGlyph className="size-3.5" />
    ) : (
      <Wrench className="size-3.5" />
    );

    if (hasError) {
      return (
        <ToolCallRow
          icon={<WarningCircle className="size-3.5" weight="fill" />}
          label={toolName}
          meta={isFramerTool ? "Framer" : "Tool"}
          summaryOnly
          status="Error"
          summary={(part as any).errorText}
          tone="danger"
        />
      );
    }

    if (hasOutput) {
      if (rawToolName === "save_preference") {
        const input = "input" in part ? (part as any).input : null;
        const category = input?.category ?? "preference";
        const content = input?.content ?? "";
        const categoryLabel =
          category === "correction"
            ? "Correction"
            : category === "workflow"
              ? "Workflow"
              : "Preference";

        return (
          <ToolCallRow
            icon={<CheckCircle className="size-3.5" weight="fill" />}
            label={`${categoryLabel} saved`}
            meta={categoryLabel}
            summaryOnly
            status="Done"
            summary={content}
            tone="accent"
          />
        );
      }

      const richUI = renderFramerToolOutput(
        rawToolName,
        (part as any).output,
        allFieldNames,
        allFieldTypes,
      );
      if (richUI) {
        return (
          <ToolCallRow
            icon={toolIcon}
            label={toolName}
            meta={isFramerTool ? "Framer" : "Tool"}
            summaryOnly
            status={statusLabel}
            summary={getToolSummary(rawToolName, "done")}
            tone={tone}
          >
            {richUI}
          </ToolCallRow>
        );
      }
    }

    return (
      <ToolCallRow
        icon={toolIcon}
        label={toolName}
        loading={isActivelyRunning}
        meta={isFramerTool ? "Framer" : "Tool"}
        summaryOnly
        shimmer={isActivelyRunning}
        status={statusLabel}
        summary={
          isStale
            ? getToolSummary(rawToolName, "stopped")
            : hasOutput
              ? getToolSummary(rawToolName, "done")
              : getToolSummary(rawToolName, "running")
        }
        tone={tone}
      />
    );
  }

  return null;
}
