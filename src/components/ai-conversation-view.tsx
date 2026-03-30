"use client";

import { CircleNotch, GlobeSimple, Rows, Sparkle } from "@phosphor-icons/react";
import { useMemo } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { AIMessagePartRenderer } from "@/components/ai-message-part-renderer";
import type { FieldNameMap, FieldTypeMap } from "@/components/ai-tool-renderers";
import { Shimmer } from "@/components/ui/shimmer";
import type { BulkApplyResult } from "@/lib/ai-bulk-apply";
import type { AIChatMessage } from "@/lib/ai-chat-types";
import type { BlogCollectionMetadata, BlogPostRecord } from "@/lib/cms-types";

interface AIConversationViewProps {
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
  allFieldNames: FieldNameMap;
  allFieldTypes: FieldTypeMap;
  emptyDescription?: string;
  emptyTitle?: string;
  errorContent?: React.ReactNode;
  getToolTimingMeta: (toolCallId?: string | null) => string | null;
  handleApplied: (result: BulkApplyResult) => void;
  isStreaming: boolean;
  messageContexts: Record<string, Array<{ id: string; title: string }>>;
  messages: AIChatMessage[];
  onPreviewPost: (post: BlogPostRecord | null) => void;
  rawToolInputs: Record<string, { text: string; toolName?: string | null }>;
  selectedPosts: BlogPostRecord[];
  streamingIndicator?: React.ReactNode;
  metadata: BlogCollectionMetadata;
  activeToolNames?: string[];
}

export function AIConversationView({
  addToolApprovalResponse,
  allFieldNames,
  allFieldTypes,
  emptyDescription = "Ask me anything about this CMS, the active Framer collection, or the rows you've selected.",
  emptyTitle = "How can I help?",
  errorContent,
  getToolTimingMeta,
  handleApplied,
  isStreaming,
  messageContexts,
  messages,
  onPreviewPost,
  rawToolInputs,
  selectedPosts,
  streamingIndicator,
  metadata,
  activeToolNames = [],
}: AIConversationViewProps) {
  const shouldShowTurnIndicator = useMemo(() => {
    if (!isStreaming) {
      return false;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") {
      return true;
    }

    return !lastMessage.parts.some((part) => {
      if (part.type === "text" && part.text.trim().length > 0) {
        return true;
      }

      if (part.type === "reasoning") {
        const reasoningPart = part as { text?: string };
        return (reasoningPart.text ?? "").trim().length > 0;
      }

      if (part.type.startsWith("tool-")) {
        return true;
      }

      return false;
    });
  }, [isStreaming, messages]);

  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent className="gap-5 px-4 py-4">
        {messages.length === 0 ? (
          <ConversationEmptyState className="items-stretch">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-fresco-divider/70 bg-fresco-surface-muted/60">
                <Sparkle
                  className="size-5 text-fresco-subtitle"
                  weight="duotone"
                />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-fresco-title">
                  {emptyTitle}
                </h3>
                <p className="text-sm leading-relaxed text-fresco-description">
                  {emptyDescription}
                </p>
              </div>
            </div>
          </ConversationEmptyState>
        ) : null}

        {messages.map((message) => {
          const sources = message.parts.filter(
            (
              part,
            ): part is typeof part & {
              type: "source-url";
              url: string;
              title?: string;
            } => part.type === "source-url",
          );
          const hasTextContent = message.parts.some(
            (part) => part.type === "text" && part.text.length > 0,
          );
          const isLastMessage = message.id === messages[messages.length - 1]?.id;
          const showSourcesSpinner =
            isLastMessage &&
            isStreaming &&
            sources.length > 0 &&
            !hasTextContent;
          const lastCmsActionIdx = message.parts.reduce(
            (lastIndex, part, index) =>
              part.type === "tool-propose_cms_action" ? index : lastIndex,
            -1,
          );

          return (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.role === "user" &&
                messageContexts[message.id]?.length ? (
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {messageContexts[message.id].map((context) => (
                      <span
                        key={context.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-fresco-divider/70 bg-fresco-surface-muted/80 px-2.5 py-1 text-[11px] font-medium text-fresco-tint"
                      >
                        <Rows className="size-3 shrink-0" weight="fill" />
                        <span className="max-w-32 truncate">{context.title}</span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {sources.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <GlobeSimple
                      className="size-3.5 shrink-0 text-fresco-subtitle"
                      weight="fill"
                    />
                    {sources.map((source, sourceIndex) => (
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
                    {showSourcesSpinner ? (
                      <CircleNotch className="size-3.5 shrink-0 animate-spin text-fresco-subtitle" />
                    ) : null}
                  </div>
                ) : null}

                {message.parts.map((part, index) => (
                  <AIMessagePartRenderer
                    addToolApprovalResponse={addToolApprovalResponse}
                    allFieldNames={allFieldNames}
                    allFieldTypes={allFieldTypes}
                    getToolTimingMeta={getToolTimingMeta}
                    handleApplied={handleApplied}
                    isLastMessage={isLastMessage}
                    isStreaming={isStreaming}
                    key={`${message.id}:${index}`}
                    lastCmsActionIdx={lastCmsActionIdx}
                    metadata={metadata}
                    onPreviewPost={onPreviewPost}
                    part={part}
                    partIndex={index}
                    rawToolInputs={rawToolInputs}
                    selectedPosts={selectedPosts}
                  />
                ))}
              </MessageContent>
            </Message>
          );
        })}

        {shouldShowTurnIndicator ? (
          <div className="flex items-center gap-2 py-1 text-[12px] text-fresco-subtitle">
            <CircleNotch className="size-3.5 animate-spin" weight="bold" />
            <Shimmer as="span" className="text-fresco-subtitle" duration={1.8}>
              {activeToolNames.length > 0
                ? activeToolNames[activeToolNames.length - 1]
                : "Thinking…"}
            </Shimmer>
          </div>
        ) : null}

        {streamingIndicator}
        {errorContent}
      </ConversationContent>

      <ConversationScrollButton />
    </Conversation>
  );
}
