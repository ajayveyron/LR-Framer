"use client";

import React from "react";
import {
  X,
  WarningCircle,
  ArrowClockwise,
  CircleNotch,
  PaperPlaneRight,
  Stop,
  Plus,
  ClockCounterClockwise,
  PlusIcon,
  Gauge,
  CurrencyDollarIcon,
  ChatCircleIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";

import { ChipInput, type ChipInputHandle } from "@/components/chip-input";
import { cn } from "@/lib/utils";

import {
  useBillingUsage,
  getMeterState,
  METER_COLORS,
  METER_BG_COLORS,
  invalidateBillingUsage,
} from "@/lib/use-billing-usage";

import type {
  AIChatMessage,
} from "@/lib/ai-chat-types";

import { ChatHistoryPanel } from "@/components/chat-history-panel";
import { UpgradeButton } from "@/components/upgrade-button";

import {
  PromptInput,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputButton,
  PromptInputProvider,
  usePromptInputController,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  buildSyntheticPost,
} from "@/components/cms-action-confirmation";
import type { CmsActionProposal } from "@/lib/cms-action-types";
import {
  type FieldNameMap,
  type FieldTypeMap,
} from "@/components/ai-tool-renderers";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui/shimmer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BlogCollectionMetadata, BlogPostRecord } from "@/lib/cms-types";
import type { BulkApplyResult } from "@/lib/ai-bulk-apply";
import { getCollectionHeader } from "@/lib/product-framer-shared";
import { PostEditor } from "@/components/post-editor";
import { useAIChatSession } from "@/lib/use-ai-chat-session";
import { AIConversationView } from "@/components/ai-conversation-view";

interface AIChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPosts: BlogPostRecord[];
  metadata: BlogCollectionMetadata;
  onPostsUpdated: (updatedPosts: BlogPostRecord[]) => void;
  onClearSelection?: () => void;
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
  variant?: "embedded" | "sheet";
  className?: string;
}

type ChatSuggestion = {
  description: string;
  prompt: string;
  title: string;
};

const EMPTY_CHAT_SUGGESTIONS: ChatSuggestion[] = [
  {
    title: "Review the collection",
    description: "Spot structure issues, missing fields, or weak patterns.",
    prompt: "Review this collection and tell me what looks off or incomplete.",
  },
  {
    title: "Improve CMS fields",
    description: "Ask for a practical Framer field mapping or cleanup plan.",
    prompt: "Help me map these CMS fields to a better Framer setup.",
  },
  {
    title: "Draft something new",
    description: "Generate a fresh post idea for this collection.",
    prompt: "Draft a new blog post idea that fits this collection.",
  },
  {
    title: "Find content gaps",
    description: "See what topics or metadata the collection is missing.",
    prompt: "Show me the biggest content or metadata gaps in this collection.",
  },
];

const SELECTED_CHAT_SUGGESTIONS: ChatSuggestion[] = [
  {
    title: "Rewrite the selection",
    description: "Make the selected rows clearer and more consistent.",
    prompt:
      "Rewrite the selected rows to be clearer, tighter, and more consistent.",
  },
  {
    title: "Improve SEO metadata",
    description: "Generate better titles, slugs, or descriptions.",
    prompt:
      "Suggest better titles, slugs, and SEO metadata for the selected rows.",
  },
  {
    title: "Find issues",
    description: "Call out missing fields, format drift, or weak copy.",
    prompt:
      "Find missing metadata, formatting issues, or weak copy in the selected rows.",
  },
  {
    title: "Batch edit",
    description: "Turn the selected rows into a polished editorial batch.",
    prompt: "Help me turn the selected rows into a polished editorial batch.",
  },
];

function formatElapsedMs(elapsedMs: number) {
  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`;
  }

  const seconds = elapsedMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const wholeMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${wholeMinutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function formatTimeLabel(ts: string) {
  const date = new Date(ts);
  if (Number.isNaN(date.valueOf())) {
    return ts;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatToolTimingMeta(timing?: {
  firstSeenAt: string;
  firstSeenElapsedMs: number;
  lastSeenElapsedMs: number;
  finishedElapsedMs?: number;
}) {
  if (!timing) {
    return null;
  }

  const finishedOrLastElapsedMs =
    timing.finishedElapsedMs ?? timing.lastSeenElapsedMs;
  const durationMs = Math.max(
    0,
    finishedOrLastElapsedMs - timing.firstSeenElapsedMs,
  );
  return `Started ${formatTimeLabel(timing.firstSeenAt)} • ${formatElapsedMs(durationMs)}`;
}

function getActiveToolNames(messages: AIChatMessage[]) {
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistantMessage?.parts?.length) {
    return [];
  }

  const names = lastAssistantMessage.parts.flatMap((part) => {
    if (!part.type.startsWith("tool-")) {
      return [];
    }

    const state = "state" in part ? (part.state as string | undefined) : undefined;
    const hasOutput =
      ("output" in part && part.output != null) ||
      ("result" in part && part.result != null);

    if (
      hasOutput ||
      state === "output-available" ||
      state === "output-error" ||
      state === "output-denied" ||
      state === "approval-requested"
    ) {
      return [];
    }

    return [
      part.type.replace(/^tool-framer_/, "").replace(/^tool-/, "").replace(/_/g, " "),
    ];
  });

  return [...new Set(names)];
}

function AttachmentPreviewStrip() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;

  return (
    <PromptInputHeader>
      {attachments.files.map((file) => {
        const ext = file.filename?.split(".").pop()?.toUpperCase() ?? "FILE";
        const isImage = file.mediaType?.startsWith("image/") && file.url;
        return (
          <div
            key={file.id}
            className="group relative size-20 shrink-0 overflow-hidden rounded border border-fresco-divider bg-fresco-surface-muted"
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={file.filename ?? "attachment"}
                className="size-full object-cover"
                src={file.url}
              />
            ) : (
              <span className="flex size-full flex-col items-center justify-center gap-0.5">
                <span className="text-[10px] font-semibold uppercase text-fresco-subtitle">
                  {ext}
                </span>
                <span className="max-w-full truncate px-1 text-[8px] text-fresco-description">
                  {file.filename}
                </span>
              </span>
            )}
            <Button
              aria-label={`Remove ${file.filename ?? "attachment"}`}
              className="absolute right-1 top-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              onClick={() => attachments.remove(file.id)}
              size="icon-xs"
              type="button"
              variant="destructive"
            >
              <X className="size-2.5" />
            </Button>
          </div>
        );
      })}
    </PromptInputHeader>
  );
}

function DirectAttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      aria-label="Add file"
      onClick={() => attachments.openFileDialog()}
      type="button"
    >
      <Plus className="size-4" />
    </PromptInputButton>
  );
}

function AIChatPanelContent({
  open,
  onOpenChange,
  selectedPosts,
  metadata,
  onPostsUpdated,
  onClearSelection,
  pendingPrompt,
  onPendingPromptConsumed,
  variant = "sheet",
  className,
}: AIChatPanelProps) {
  const { textInput } = usePromptInputController();
  const [previewPost, setPreviewPost] = useState<BlogPostRecord | null>(null);

  const bodyData = useMemo(
    () => ({
      selectedRows: selectedPosts.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        fieldValues: p.fieldValues,
      })),
      fieldDefinitions: metadata.fields
        .filter((f) => f.supported)
        .map((f) => ({ id: f.id, name: f.name, type: f.type })),
      activeCollectionId: metadata.collectionId,
      activeCollectionName: metadata.collectionName,
    }),
    [
      selectedPosts,
      metadata.fields,
      metadata.collectionId,
      metadata.collectionName,
    ],
  );

  const {
    addToolApprovalResponse,
    clearError,
    error,
    handleNewChat,
    handleRestoreConversation,
    handleSendWithContext,
    isStreaming,
    messageContexts,
    messages,
    rawToolInputs,
    regenerate,
    setShowHistory,
    showHistory,
    status,
    stop,
    toolTimingByCallId,
    totalTokens,
  } = useAIChatSession({
    bodyData,
    pendingPrompt,
    onClearSelection,
    onPendingPromptConsumed,
    selectedPosts,
    textInput,
  });

  // Map field IDs → human-readable names for rich tool output rendering
  // Scans all messages for framer_get_collection_fields outputs to cover any collection
  const allFieldNames = useMemo<FieldNameMap>(() => {
    const map: FieldNameMap = {};
    for (const f of metadata.fields) map[f.id] = f.name;
    for (const msg of messages) {
      for (const p of msg.parts) {
        if (
          p.type === "tool-framer_get_collection_fields" &&
          "output" in p &&
          Array.isArray((p as any).output)
        ) {
          for (const f of (p as any).output) {
            if (f && typeof f.id === "string" && typeof f.name === "string") {
              map[f.id] = f.name;
            }
          }
        }
      }
    }
    return map;
  }, [metadata.fields, messages]);

  const allFieldTypes = useMemo<FieldTypeMap>(() => {
    const map: FieldTypeMap = {};
    for (const f of metadata.fields) map[f.id] = f.type;
    for (const msg of messages) {
      for (const p of msg.parts) {
        if (
          p.type === "tool-framer_get_collection_fields" &&
          "output" in p &&
          Array.isArray((p as any).output)
        ) {
          for (const f of (p as any).output) {
            if (f && typeof f.id === "string" && typeof f.type === "string") {
              map[f.id] = f.type;
            }
          }
        }
      }
    }
    return map;
  }, [metadata.fields, messages]);

  useEffect(() => {
    if (messages.length === 0) {
      processedStagedToolCallsRef.current.clear();
    }
  }, [messages.length]);

  const activeToolNames = useMemo(() => getActiveToolNames(messages), [messages]);
  const [, setStreamTimingTick] = useState(0);
  const portalContainer = useMemo(
    () =>
      typeof document === "undefined"
        ? null
        : document.getElementById("dashboard-shell"),
    [],
  );

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const interval = window.setInterval(() => {
      setStreamTimingTick((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isStreaming]);

  function handleApplied(result: BulkApplyResult) {
    if (result.succeeded.length > 0) {
      Promise.all(
        result.succeeded.map((id) =>
          fetch(`/api/posts/${id}`, { headers: getCollectionHeader() })
            .then((r) => r.json())
            .then((data) => data.post as BlogPostRecord),
        ),
      ).then((updatedPosts) => {
        onPostsUpdated(updatedPosts.filter(Boolean));
      });
    }
  }

  const processedStagedToolCallsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const stagedPosts: BlogPostRecord[] = [];

    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type !== "tool-propose_cms_action") {
          continue;
        }

        const toolCallId =
          "toolCallId" in part && typeof (part as any).toolCallId === "string"
            ? ((part as any).toolCallId as string)
            : null;

        if (!toolCallId || processedStagedToolCallsRef.current.has(toolCallId)) {
          continue;
        }

        const output =
          "output" in part && part.output && typeof part.output === "object"
            ? (part.output as {
                staged?: boolean;
                action?: string;
                items?: Array<{
                  id?: string;
                  stagedId?: string;
                  slug: string;
                  draft?: boolean;
                  fieldData?: Record<
                    string,
                    { type: string; value: unknown }
                  >;
                }>;
              })
            : null;
        const input =
          "input" in part && part.input && typeof part.input === "object"
            ? (part.input as CmsActionProposal)
            : null;

        if (
          !output?.staged ||
          output.action !== "add_items" ||
          !Array.isArray(output.items) ||
          !input?.payload ||
          input.payload.action !== "add_items" ||
          input.payload.collectionId !== metadata.collectionId
        ) {
          continue;
        }

        for (const item of output.items) {
          const synthetic = buildSyntheticPost(item, allFieldNames);
          stagedPosts.push({
            ...synthetic,
            id: item.id ?? synthetic.id,
            staged: true,
            stagedId: item.stagedId,
          });
        }

        processedStagedToolCallsRef.current.add(toolCallId);
      }
    }

    if (stagedPosts.length > 0) {
      onPostsUpdated(stagedPosts);
    }
  }, [allFieldNames, messages, metadata.collectionId, onPostsUpdated]);

  const getToolTimingMeta = useCallback(
    (toolCallId?: string | null) => {
      if (!toolCallId) {
        return null;
      }

      const timing = toolTimingByCallId[toolCallId];
      if (!timing) {
        return null;
      }

      if (timing.finishedElapsedMs != null) {
        return formatToolTimingMeta(timing);
      }

      const liveDurationMs = Math.max(
        0,
        Date.now() - new Date(timing.firstSeenAt).getTime(),
      );

      return `Started ${formatTimeLabel(timing.firstSeenAt)} • ${formatElapsedMs(liveDurationMs)}`;
    },
    [toolTimingByCallId],
  );

  const chatPanelContent = (
    <>
      {/* Chat content — clipped so the preview drawer can overflow to the left */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-fresco-divider px-4 py-2">
          <ChatCircleIcon
            className="size-5 shrink-0 text-fresco-tint"
            weight="duotone"
          />
          <div className="min-w-0 flex-1">
            <span className="text-sm">AI Assistant</span>
          </div>
          <Button
            aria-label="Chat history"
            className="size-7 shrink-0"
            onClick={() => setShowHistory((v) => !v)}
            size="icon-sm"
            title="Chat history"
            type="button"
            variant="ghost"
          >
            <ClockCounterClockwise className="size-4" />
          </Button>
          {messages.length > 0 && (
            <Button
              aria-label="New chat"
              className="size-7 shrink-0"
              onClick={handleNewChat}
              size="icon-sm"
              title="New chat"
              type="button"
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </Button>
          )}
          <Button
            aria-label="Close AI panel"
            className="size-7 shrink-0"
            onClick={() => onOpenChange(false)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        {showHistory ? (
          <ChatHistoryPanel
            onSelect={handleRestoreConversation}
            onBack={() => setShowHistory(false)}
          />
        ) : (
          <>
            <AIConversationView
              addToolApprovalResponse={addToolApprovalResponse}
              allFieldNames={allFieldNames}
              allFieldTypes={allFieldTypes}
              errorContent={
                error && !isStreaming && !isRecoverableAIError(error.message) ? (
                  <QuotaOrError
                    error={error}
                    onRetry={() => {
                      clearError();
                      regenerate();
                    }}
                  />
                ) : null
              }
              getToolTimingMeta={getToolTimingMeta}
              handleApplied={handleApplied}
              isStreaming={isStreaming}
              messageContexts={messageContexts}
              messages={messages}
              metadata={metadata}
              onPreviewPost={setPreviewPost}
              rawToolInputs={rawToolInputs}
              selectedPosts={selectedPosts}
              streamingIndicator={null}
            />

            {/* Input */}
            <div className="border-t border-fresco-divider p-4 pb-8">
              <ChatInputOrQuotaGate
                totalTokens={totalTokens}
                selectedPosts={selectedPosts}
                messageCount={messages.length}
                isStreaming={isStreaming}
                activeToolNames={activeToolNames}
                sendMessage={handleSendWithContext}
                stop={stop}
                onClearSelection={onClearSelection}
              />
            </div>
          </>
        )}

        </div>{/* end chat content wrapper */}

        {/* Post preview drawer — rendered inside SheetContent to avoid Radix scroll lock */}
        {previewPost && (
          <div
            data-cms-preview-drawer
            className="absolute inset-y-0 right-full z-10 flex w-[min(48vw,640px)] flex-col overflow-hidden border-r border-fresco-divider bg-fresco-panel text-fresco-title shadow-[-20px_0_60px_rgba(0,0,0,0.35)] animate-in slide-in-from-right-4 fade-in-0 duration-300"
          >
            <div className="min-h-0 flex-1 overflow-hidden [&>*]:h-full [&>*]:min-w-0">
              <PostEditor
                metadata={metadata}
                mode="create"
                onClose={() => setPreviewPost(null)}
                onPostSaved={() => {}}
                post={previewPost}
              />
            </div>
          </div>
        )}
    </>
  );

  if (variant === "embedded") {
    return (
      <div
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-visible bg-fresco-panel text-fresco-title",
          className,
        )}
      >
        {chatPanelContent}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "absolute z-[80] flex flex-col gap-0 overflow-visible border-fresco-divider bg-fresco-panel p-0 text-fresco-title shadow-[-40px_0_120px_rgba(0,0,0,0.55)] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-full data-[side=right]:sm:max-w-none md:data-[side=right]:w-[min(48vw,640px)]",
          className,
        )}
        overlayClassName="absolute inset-0 z-[70] bg-black/50 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        portalContainer={portalContainer}
        showCloseButton={false}
        side="right"
        onPointerDownOutside={(e) => {
          // Prevent closing the AI chat when the preview drawer is open
          if (document.querySelector("[data-cms-preview-drawer]")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (document.querySelector("[data-cms-preview-drawer]")) {
            e.preventDefault();
          }
        }}
      >
        <SheetTitle className="sr-only">AI Assistant</SheetTitle>
        <SheetDescription className="sr-only">
          Chat with AI to manage your CMS, edit posts, and more.
        </SheetDescription>
        {chatPanelContent}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Proactively gates the chat input when the free-plan quota is exhausted.
 * If usage >= 100% on the Free plan, replaces the input with an upgrade callout.
 * Otherwise renders the normal PromptInput with token counter and usage bar.
 */
function ChatInputOrQuotaGate({
  totalTokens,
  selectedPosts,
  messageCount,
  isStreaming,
  activeToolNames,
  sendMessage,
  stop,
  onClearSelection,
}: {
  totalTokens: { input: number; output: number; total: number };
  selectedPosts: BlogPostRecord[];
  messageCount: number;
  isStreaming: boolean;
  activeToolNames: string[];
  sendMessage: (msg: { text: string }) => void;
  stop: () => void;
  onClearSelection?: () => void;
}) {
  const controller = usePromptInputController();
  const draft = controller.textInput.value.trim();
  const { data } = useBillingUsage();
  const isExhausted =
    data && data.planName === "Free" && data.percentUsed >= 100;

  const suggestions =
    selectedPosts.length > 0
      ? SELECTED_CHAT_SUGGESTIONS
      : EMPTY_CHAT_SUGGESTIONS;
  const showSuggestions =
    messageCount === 0 && draft.length === 0 && !isStreaming && !isExhausted;

  if (isExhausted) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-fresco-error/20 bg-fresco-error/5 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Gauge className="size-5 shrink-0 text-fresco-error" weight="fill" />
          <span className="text-sm font-medium text-fresco-title">
            Monthly AI allowance reached
          </span>
        </div>
        <p className="text-xs leading-relaxed text-fresco-description">
          Your team has used 100% of this month&apos;s AI tokens. Upgrade to
          Standard for 100× more capacity.
        </p>
        <UpgradeButton className="w-fit" />
      </div>
    );
  }

  return (
    <>
      {process.env.NODE_ENV === "development" && totalTokens.total > 0 && (
        <div className="mb-1.5 flex items-center justify-between text-[10px] tabular-nums text-fresco-subtitle">
          <span>
            <CurrencyDollarIcon
              className="mr-1 inline size-3 align-[-2px]"
              weight="bold"
            />
            {totalTokens.total.toLocaleString()} tokens this session
          </span>
        </div>
      )}
      {showSuggestions && (
        <Suggestions className="mb-2">
          {suggestions.map((s) => (
            <Suggestion
              key={s.title}
              suggestion={s.title}
              onClick={() => sendMessage({ text: s.prompt })}
            />
          ))}
        </Suggestions>
      )}
      <ChipInputPromptArea
        selectedPosts={selectedPosts}
        isStreaming={isStreaming}
        sendMessage={sendMessage}
        stop={stop}
        onClearSelection={onClearSelection}
      />
      <ChatUsageBar />
    </>
  );
}

/**
 * Wraps PromptInput with an inline ChipInput that replaces the textarea.
 * Selected post chips render inline before the text cursor.
 */
function ChipInputPromptArea({
  selectedPosts,
  isStreaming,
  sendMessage,
  stop,
  onClearSelection,
}: {
  selectedPosts: BlogPostRecord[];
  isStreaming: boolean;
  sendMessage: (msg: { text: string }) => void;
  stop: () => void;
  onClearSelection?: () => void;
}) {
  const controller = usePromptInputController();
  const attachments = usePromptInputAttachments();
  const chipInputRef = useRef<ChipInputHandle>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const chips = useMemo(
    () =>
      selectedPosts.length > 0
        ? [
            {
              id: "__selection",
              label:
                selectedPosts.length === 1
                  ? "1 row selected"
                  : `${selectedPosts.length} rows selected`,
            },
          ]
        : [],
    [selectedPosts.length],
  );

  const handleRemoveChip = useCallback(() => {
    onClearSelection?.();
  }, [onClearSelection]);

  const handleChange = useCallback(
    (text: string) => {
      controller.textInput.setInput(text);
    },
    [controller.textInput],
  );

  const handleSubmit = useCallback(() => {
    const form = wrapperRef.current?.closest("form");
    if (!form) return;
    const submitBtn = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    if (submitBtn?.disabled) return;
    form.requestSubmit();
  }, []);

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        attachments.add(files);
      }
    },
    [attachments],
  );

  const handleBackspaceEmpty = useCallback(() => {
    if (attachments.files.length > 0) {
      const last = attachments.files.at(-1);
      if (last) attachments.remove(last.id);
    }
  }, [attachments]);

  return (
    <PromptInput
      onSubmit={(message) => {
        if (!message.text.trim()) return;
        sendMessage({ text: message.text });
        chipInputRef.current?.clear();
      }}
    >
      <AttachmentPreviewStrip />
      <div
        ref={wrapperRef}
        data-align="block-start"
        className="flex w-full flex-col !pt-0"
      >
        <ChipInput
          ref={chipInputRef}
          autoFocus
          chips={chips}
          value={controller.textInput.value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onPaste={handlePaste}
          onBackspaceEmpty={handleBackspaceEmpty}
          onRemoveChip={handleRemoveChip}
          placeholder={
            selectedPosts.length > 0
              ? "Ask about these items…"
              : "Ask anything about this collection…"
          }
        />
      </div>
      <PromptInputFooter>
        <DirectAttachButton />
        <div className="flex-1" />
        {isStreaming ? (
          <Button
            aria-label="Stop generating"
            className="size-8 shrink-0"
            onClick={stop}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Stop className="size-4" weight="fill" />
          </Button>
        ) : (
          <PromptInputSubmit
            aria-label="Send message"
            className="size-8 shrink-0"
            size="icon-sm"
            type="submit"
          >
            <PaperPlaneRight className="size-4" weight="fill" />
          </PromptInputSubmit>
        )}
      </PromptInputFooter>
    </PromptInput>
  );
}

/**
 * Detects whether an error is a quota-exhaustion 429 and renders either
 * a polished upgrade prompt or the generic error pill.
 */
function QuotaOrError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const rawMessage = error.message ?? "Something went wrong.";
  const isQuota = /allowance|exhausted|429/i.test(rawMessage);
  const normalizedMessage = normalizeAIErrorMessage(rawMessage);

  if (isQuota) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-fresco-error/20 bg-fresco-error/5 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Gauge className="size-5 shrink-0 text-fresco-error" weight="fill" />
          <span className="text-sm font-medium text-fresco-title">
            Monthly AI allowance reached
          </span>
        </div>
        <p className="text-xs leading-relaxed text-fresco-description">
          Your team has used 100% of this month&apos;s AI tokens. Upgrade to
          Standard for 100× more capacity.
        </p>
        <UpgradeButton className="w-fit" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">
      <WarningCircle className="size-3.5 shrink-0" weight="fill" />
      <span className="min-w-0 flex-1 truncate">{normalizedMessage}</span>
      <Button
        className="h-auto shrink-0 gap-1 rounded-full px-2 py-1 text-red-200 hover:bg-red-500/15 hover:text-red-100"
        onClick={onRetry}
        size="xs"
        type="button"
        variant="ghost"
      >
        <ArrowClockwise className="size-3.5" weight="bold" />
        <span>Retry</span>
      </Button>
    </div>
  );
}

function normalizeAIErrorMessage(message: string) {
  if (isRecoverableAIError(message)) {
    return "A tool call ended before returning a result. Try again.";
  }

  if (/network|fetch failed|failed to fetch/i.test(message)) {
    return "The request failed before the assistant could finish. Try again.";
  }

  return message;
}

function isRecoverableAIError(message: string) {
  return /tool result is missing for tool call/i.test(message);
}

/**
 * Subtle usage bar below the chat input for free plan users.
 * Uses the shared billing hook which auto-refreshes when
 * invalidateBillingUsage() fires after each chat turn.
 */
function ChatUsageBar() {
  const { data, loading } = useBillingUsage();
  if (loading || !data || data.planName !== "Free") return null;

  const state = getMeterState(data.percentUsed);
  const color = METER_COLORS[state];
  const bg = METER_BG_COLORS[state];

  return (
    <div className="mt-2 flex items-center gap-2">
      <div
        className="h-1 min-w-0 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: bg }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(data.percentUsed, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="shrink-0 text-[10px] tabular-nums" style={{ color }}>
        {data.percentUsed}% used
      </span>
    </div>
  );
}

class AIChatErrorBoundary extends React.Component<
  { children: React.ReactNode; onNewChat?: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onNewChat?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[AIChatPanel] Render error caught by boundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <WarningCircle className="size-10 text-fresco-subtitle" />
          <p className="text-[13px] text-fresco-text">
            Chat encountered an error.
          </p>
          <button
            className="rounded-lg bg-fresco-tint px-4 py-2 text-[12px] font-medium text-black transition-colors hover:bg-fresco-tint/80"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onNewChat?.();
            }}
            type="button"
          >
            New Chat
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AIChatPanel(props: AIChatPanelProps) {
  return (
    <AIChatErrorBoundary>
      <PromptInputProvider>
        <AIChatPanelContent {...props} />
      </PromptInputProvider>
    </AIChatErrorBoundary>
  );
}
