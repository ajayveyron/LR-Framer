"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkle, X, WarningCircle, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { EditProposalView } from "@/components/edit-proposal-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  BlogCollectionMetadata,
  BlogPostRecord,
} from "@/lib/cms-types";
import { parseEditProposals } from "@/lib/ai-edit-parser";
import type { BulkApplyResult } from "@/lib/ai-bulk-apply";

interface AIChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPosts: BlogPostRecord[];
  metadata: BlogCollectionMetadata;
  onPostsUpdated: (updatedPosts: BlogPostRecord[]) => void;
}

export function AIChatPanel({
  open,
  onOpenChange,
  selectedPosts,
  metadata,
  onPostsUpdated,
}: AIChatPanelProps) {
  const [chatKey, setChatKey] = useState(() => crypto.randomUUID());

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
    }),
    [selectedPosts, metadata.fields],
  );

  // Include chatKey in the dep so a new transport is created on reset
  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: bodyData,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bodyData, chatKey],
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    error,
  } = useChat({
    transport: chatTransport,
    onError: (err) => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "error",
          event: "ai.chat_panel.error",
          message: err.message,
        }),
      );
    },
  });

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setChatKey(crypto.randomUUID());
  }, [setMessages]);

  const isStreaming = status === "streaming" || status === "submitted";

  function handleApplied(result: BulkApplyResult) {
    if (result.succeeded.length > 0) {
      // Refetch updated posts from the server
      Promise.all(
        result.succeeded.map((id) =>
          fetch(`/api/posts/${id}`)
            .then((r) => r.json())
            .then((data) => data.post as BlogPostRecord),
        ),
      ).then((updatedPosts) => {
        onPostsUpdated(updatedPosts.filter(Boolean));
      });
    }
  }

  const truncatedTitles = selectedPosts
    .slice(0, 3)
    .map((p) => p.title)
    .join(", ");
  const moreCount = selectedPosts.length - 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col gap-0 overflow-hidden border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] p-0 text-[color:var(--framer-fresco-panelTitle-color)] shadow-[-40px_0_120px_rgba(0,0,0,0.55)] data-[side=right]:w-full data-[side=right]:sm:max-w-none md:data-[side=right]:top-2 md:data-[side=right]:right-2 md:data-[side=right]:bottom-2 md:data-[side=right]:w-[min(48vw,640px)]"
        showCloseButton={false}
        side="right"
      >
        <SheetTitle className="sr-only">AI Edit Panel</SheetTitle>
        <SheetDescription className="sr-only">
          Chat with AI to bulk edit selected CMS rows.
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--framer-fresco-panelDivider-color)] px-4 py-3">
          <Sparkle
            className="size-5 shrink-0 text-[color:var(--framer-fresco-tint-color)]"
            weight="duotone"
          />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold">AI Edit</span>
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
              <Badge
                className="h-5 px-1.5 text-[10px] font-semibold"
                variant="secondary"
              >
                {selectedPosts.length}
              </Badge>
              <span className="truncate">
                {truncatedTitles}
                {moreCount > 0 && ` +${moreCount} more`}
              </span>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              aria-label="New chat"
              className="size-8 shrink-0"
              onClick={handleNewChat}
              size="icon-sm"
              title="New chat"
              type="button"
              variant="ghost"
            >
              <ArrowCounterClockwise className="size-4" />
            </Button>
          )}
          <Button
            aria-label="Close AI panel"
            className="size-8 shrink-0"
            onClick={() => onOpenChange(false)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Messages */}
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="gap-6 px-4 py-4">
            {messages.length === 0 && (
              <ConversationEmptyState
                title="What do you want to change?"
                description={`${selectedPosts.length} row${selectedPosts.length === 1 ? "" : "s"} selected. Describe the edits you want and I'll propose changes for review.`}
                icon={
                  <Sparkle
                    className="size-8 text-[color:var(--framer-fresco-panelSubtitle-color)]"
                    weight="duotone"
                  />
                }
              />
            )}

            {messages.map((message) => {
              return (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text" && part.text.length > 0) {
                      return (
                        <MessageResponse key={i}>
                          {part.text}
                        </MessageResponse>
                      );
                    }

                    if (part.type === "tool-propose_edits") {
                      const toolData = ("output" in part && part.output) ? part.output : part.input;
                      if (!toolData) return null;
                      const edits = parseEditProposals(toolData);
                      if (edits.length === 0) return null;

                      return (
                        <EditProposalView
                          key={i}
                          edits={edits}
                          posts={selectedPosts}
                          fieldDefinitions={
                            metadata.fields
                              .filter((f) => f.supported)
                          }
                          onApplied={handleApplied}
                        />
                      );
                    }

                    return null;
                  })}
                </MessageContent>
              </Message>
            );})}

            {isStreaming && messages.at(-1)?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-xs text-[color:var(--framer-fresco-panelSubtitle-color)]">
                <span className="inline-block size-2 animate-pulse rounded-full bg-[var(--framer-fresco-tint-color)]" />
                Thinking…
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 border-t border-[var(--framer-fresco-panelDivider-color)] px-4 py-2 text-xs text-red-400">
            <WarningCircle className="size-4 shrink-0" weight="fill" />
            <span className="truncate">{error.message}</span>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-[var(--framer-fresco-panelDivider-color)] px-4 py-3">
          <PromptInput
            onSubmit={({ text }) => {
              if (!text.trim()) return;
              if (isStreaming) {
                stop();
                return;
              }
              sendMessage({ text });
            }}
          >
            <PromptInputTextarea
              placeholder="Describe the changes you want…"
              disabled={selectedPosts.length === 0}
              className="min-h-10 text-sm"
            />
          </PromptInput>
        </div>
      </SheetContent>
    </Sheet>
  );
}
