"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkle, X, WarningCircle, ArrowClockwise, Wrench, CheckCircle, CircleNotch, PaperPlaneRight, Stop, GlobeSimple, ImageSquare, DownloadSimple, Plus, ClockCounterClockwise, PlusIcon, Coins, Rows } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AIChatMessage, ChatMessageMetadata } from "@/lib/ai-chat-types";

import { ChatHistoryPanel } from "@/components/chat-history-panel";
import { saveConversation, type SavedConversation } from "@/lib/chat-history";

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
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputButton,
  PromptInputProvider,
  usePromptInputController,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { EditProposalView } from "@/components/edit-proposal-view";
import { CmsActionConfirmation } from "@/components/cms-action-confirmation";
import type { CmsActionProposal } from "@/lib/cms-action-types";
import { renderFramerToolOutput, type FieldNameMap } from "@/components/ai-tool-renderers";
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
  onClearSelection?: () => void;
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
    prompt: "Rewrite the selected rows to be clearer, tighter, and more consistent.",
  },
  {
    title: "Improve SEO metadata",
    description: "Generate better titles, slugs, or descriptions.",
    prompt: "Suggest better titles, slugs, and SEO metadata for the selected rows.",
  },
  {
    title: "Find issues",
    description: "Call out missing fields, format drift, or weak copy.",
    prompt: "Find missing metadata, formatting issues, or weak copy in the selected rows.",
  },
  {
    title: "Batch edit",
    description: "Turn the selected rows into a polished editorial batch.",
    prompt: "Help me turn the selected rows into a polished editorial batch.",
  },
];

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
            className="group relative size-20 shrink-0 overflow-hidden rounded border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)]"
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={file.filename ?? "attachment"} className="size-full object-cover" src={file.url} />
            ) : (
              <span className="flex size-full flex-col items-center justify-center gap-0.5">
                <span className="text-[10px] font-semibold uppercase text-[color:var(--framer-fresco-panelSubtitle-color)]">{ext}</span>
                <span className="max-w-full truncate px-1 text-[8px] text-[color:var(--framer-fresco-panelDescription-color)]">{file.filename}</span>
              </span>
            )}
            <button
              aria-label={`Remove ${file.filename ?? "attachment"}`}
              className="cursor-default absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[red] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              onClick={() => attachments.remove(file.id)}
              type="button"
            >
              <X className="size-2.5" />
            </button>
          </div>
        );
      })}
    </PromptInputHeader>
  );
}

function DirectAttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton aria-label="Add file" onClick={() => attachments.openFileDialog()} type="button">
      <Plus className="size-4" />
    </PromptInputButton>
  );
}

function ChatPromptSuggestions({ selectedCount }: { selectedCount: number }) {
  const controller = usePromptInputController();
  const draft = controller.textInput.value.trim();
  const suggestions = selectedCount > 0 ? SELECTED_CHAT_SUGGESTIONS : EMPTY_CHAT_SUGGESTIONS;

  if (draft.length > 0) {
    return null;
  }

  return (
    <div className="mt-1 space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
        Quick starts
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            className="flex flex-col items-start gap-1 rounded-xl border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-2 text-left transition-colors hover:border-[var(--framer-fresco-tint-color)] hover:bg-[var(--framer-fresco-panelDivider-color)]"
            onClick={() => {
              controller.textInput.setInput(suggestion.prompt);
              window.requestAnimationFrame(() => {
                const textarea = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement | null;
                textarea?.focus();
                textarea?.setSelectionRange(suggestion.prompt.length, suggestion.prompt.length);
              });
            }}
            type="button"
          >
            <span className="text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
              {suggestion.title}
            </span>
            <span className="text-xs leading-snug text-[color:var(--framer-fresco-panelDescription-color)]">
              {suggestion.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AIChatPanelContent({ open, onOpenChange, selectedPosts, metadata, onPostsUpdated, onClearSelection }: AIChatPanelProps) {
  const { textInput } = usePromptInputController();
  const [chatKey, setChatKey] = useState(() => crypto.randomUUID());
  const [showHistory, setShowHistory] = useState(false);

  const bodyData = useMemo(
    () => ({
      selectedRows: selectedPosts.map((p) => ({ id: p.id, slug: p.slug, title: p.title, fieldValues: p.fieldValues })),
      fieldDefinitions: metadata.fields.filter((f) => f.supported).map((f) => ({ id: f.id, name: f.name, type: f.type })),
      activeCollectionId: metadata.collectionId,
      activeCollectionName: metadata.collectionName,
    }),
    [selectedPosts, metadata.fields, metadata.collectionId, metadata.collectionName],
  );

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: ({ id, messages: msgs, trigger, messageId }) => {
          const MAX_TOOL_RESULT_CHARS = 2000;
          const MAX_FILE_URL_LEN = 50_000;
          let lastUserIdx = -1;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "user") { lastUserIdx = i; break; }
          }
          const sanitized = msgs.map((msg, idx) => {
            if (!Array.isArray(msg.parts)) return msg;
            let needsWork = false;
            for (const p of msg.parts) {
              if (p.type === "tool-invocation" && "state" in p && (p as any).state !== "output-available") { needsWork = true; break; }
              if (p.type === "tool-invocation" && "result" in p && p.result !== undefined && JSON.stringify(p.result).length > MAX_TOOL_RESULT_CHARS) { needsWork = true; break; }
              if (idx !== lastUserIdx && p.type === "file" && "url" in p && typeof p.url === "string" && p.url.length > MAX_FILE_URL_LEN) { needsWork = true; break; }
            }
            if (!needsWork) return msg;
            return {
              ...msg,
              parts: msg.parts.map((p) => {
                // Patch dangling tool invocations (stopped mid-stream)
                if (p.type === "tool-invocation" && "state" in p && (p as any).state !== "output-available") {
                  return { ...p, state: "output-available" as const, output: { _cancelled: true, message: "Tool call was cancelled by the user." } };
                }
                if (p.type === "tool-invocation" && "result" in p && p.result !== undefined) {
                  const s = JSON.stringify(p.result);
                  if (s.length > MAX_TOOL_RESULT_CHARS) return { ...p, result: { _truncated: true, preview: s.slice(0, MAX_TOOL_RESULT_CHARS) } };
                }
                if (idx !== lastUserIdx && p.type === "file" && "url" in p && typeof p.url === "string" && p.url.length > MAX_FILE_URL_LEN) {
                  return { type: "text" as const, text: `[User attached an image: ${("filename" in p && p.filename) || "image"}]` };
                }
                return p;
              }),
            };
          });
          return { body: { ...bodyData, id, messages: sanitized, trigger, messageId } };
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bodyData, chatKey],
  );

  const { messages, sendMessage, setMessages, status, stop, error, regenerate, clearError } = useChat<AIChatMessage>({
    transport: chatTransport,
    onError: (err) => {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "ai.chat_panel.error", message: err.message }));
    },
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

  // Accumulate total token usage across all assistant messages in this conversation
  const totalTokens = useMemo(() => {
    let input = 0;
    let output = 0;
    for (const msg of messages) {
      const meta = msg.metadata as ChatMessageMetadata | undefined;
      if (meta?.inputTokens) input += meta.inputTokens;
      if (meta?.outputTokens) output += meta.outputTokens;
    }
    return { input, output, total: input + output };
  }, [messages]);

  const handleNewChat = useCallback(() => {
    if (messages.length > 0) void saveConversation(chatKey, messages);
    clearError();
    setMessages([]);
    textInput.clear();
    setChatKey(crypto.randomUUID());
    setShowHistory(false);
  }, [setMessages, messages, chatKey, clearError, textInput]);

  // Persist conversation after each assistant turn completes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasActive = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const nowIdle = status === "ready" || status === "error";
    if (wasActive && nowIdle && messages.length > 0) void saveConversation(chatKey, messages);
    prevStatusRef.current = status;
  }, [status, messages, chatKey]);

  const handleRestoreConversation = useCallback(
    (conv: SavedConversation) => {
      if (messages.length > 0) void saveConversation(chatKey, messages);
      clearError();
      setMessages(conv.messages as AIChatMessage[]);
      textInput.clear();
      setChatKey(conv.id);
      setShowHistory(false);
    },
    [setMessages, messages, chatKey, clearError, textInput],
  );

  const isStreaming = status === "streaming" || status === "submitted";

  function handleApplied(result: BulkApplyResult) {
    if (result.succeeded.length > 0) {
      Promise.all(
        result.succeeded.map((id) => fetch(`/api/posts/${id}`).then((r) => r.json()).then((data) => data.post as BlogPostRecord)),
      ).then((updatedPosts) => { onPostsUpdated(updatedPosts.filter(Boolean)); });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col gap-0 overflow-hidden border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] p-0 text-[color:var(--framer-fresco-panelTitle-color)] shadow-[-40px_0_120px_rgba(0,0,0,0.55)] data-[side=right]:w-full data-[side=right]:sm:max-w-none md:data-[side=right]:top-2 md:data-[side=right]:right-2 md:data-[side=right]:bottom-2 md:data-[side=right]:w-[min(48vw,640px)]"
        showCloseButton={false}
        side="right"
      >
        <SheetTitle className="sr-only">AI Assistant</SheetTitle>
        <SheetDescription className="sr-only">Chat with AI to manage your CMS, edit posts, and more.</SheetDescription>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--framer-fresco-panelDivider-color)] px-4 py-3">
          <Sparkle className="size-5 shrink-0 text-[color:var(--framer-fresco-tint-color)]" weight="duotone" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold">AI Assistant</span>
          </div>
          <Button aria-label="Chat history" className="size-8 shrink-0" onClick={() => setShowHistory((v) => !v)} size="icon-sm" title="Chat history" type="button" variant="ghost">
            <ClockCounterClockwise className="size-4" />
          </Button>
          {messages.length > 0 && (
            <Button aria-label="New chat" className="size-8 shrink-0" onClick={handleNewChat} size="icon-sm" title="New chat" type="button" variant="ghost">
              <PlusIcon className="size-4" />
            </Button>
          )}
          <Button aria-label="Close AI panel" className="size-8 shrink-0" onClick={() => onOpenChange(false)} size="icon-sm" type="button" variant="ghost">
            <X className="size-4" />
          </Button>
        </div>

        {showHistory ? (
          <ChatHistoryPanel onSelect={handleRestoreConversation} onBack={() => setShowHistory(false)} />
        ) : (
          <>
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="gap-6 px-4 py-4">
                {messages.length === 0 && (
                  <ConversationEmptyState
                    className="items-stretch"
                  >
                    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
                      <Sparkle className="size-8 text-[color:var(--framer-fresco-panelSubtitle-color)]" weight="duotone" />
                      <div className="space-y-1">
                        <h3 className="font-medium text-sm text-[color:var(--framer-fresco-panelTitle-color)]">How can I help?</h3>
                        <p className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                          Ask me anything about this CMS, the active Framer collection, or the rows you&apos;ve selected.
                        </p>
                      </div>
                      <ChatPromptSuggestions selectedCount={selectedPosts.length} />
                    </div>
                  </ConversationEmptyState>
                )}

                {messages.map((message) => {
                  const sources = message.parts.filter(
                    (p): p is typeof p & { type: "source-url"; url: string; title?: string } => p.type === "source-url",
                  );
                  const hasTextContent = message.parts.some((p) => p.type === "text" && p.text.length > 0);
                  const isLastMessage = message.id === messages[messages.length - 1]?.id;
                  const showSourcesSpinner = isLastMessage && isStreaming && sources.length > 0 && !hasTextContent;
                  return (
                    <Message key={message.id} from={message.role}>
                      <MessageContent>
                        {sources.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <GlobeSimple className="size-3.5 shrink-0 text-[color:var(--framer-fresco-panelSubtitle-color)]" weight="fill" />
                            {sources.map((src, si) => (
                              <a key={si} className="inline-flex max-w-48 items-center truncate rounded border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-2 py-0.5 text-[10px] text-[color:var(--framer-fresco-tint-color)] transition-colors hover:bg-[var(--framer-fresco-panelDivider-color)]" href={src.url} rel="noopener noreferrer" target="_blank">
                                {src.title || new URL(src.url).hostname}
                              </a>
                            ))}
                            {showSourcesSpinner && <CircleNotch className="size-3.5 shrink-0 animate-spin text-[color:var(--framer-fresco-panelSubtitle-color)]" />}
                          </div>
                        )}
                        {message.parts.map((part, i) => {
                          if (part.type === "file") {
                            const isImage = part.mediaType?.startsWith("image/");
                            if (isImage) {
                              return (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} alt={part.filename ?? "Attached image"} className="max-h-48 rounded-md border border-[var(--framer-fresco-panelDivider-color)] object-contain" src={part.url} />
                              );
                            }
                            return (
                              <div key={i} className="inline-flex items-center gap-1.5 rounded border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-2 py-1 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
                                <ImageSquare className="size-3.5 shrink-0" weight="fill" />
                                <span className="truncate max-w-40">{part.filename ?? "Attachment"}</span>
                              </div>
                            );
                          }
                          if (part.type === "text" && part.text.length > 0) {
                            return <MessageResponse key={i}>{part.text}</MessageResponse>;
                          }
                          if (part.type === "tool-propose_edits") {
                            const toolData = ("output" in part && part.output) ? part.output : part.input;
                            if (!toolData) return null;
                            const edits = parseEditProposals(toolData);
                            if (edits.length === 0) return null;
                            return <EditProposalView key={i} edits={edits} posts={selectedPosts} fieldDefinitions={metadata.fields.filter((f) => f.supported)} onApplied={handleApplied} />;
                          }
                          if (part.type === "tool-propose_cms_action") {
                            const toolData = ("output" in part && part.output) ? part.output : part.input;
                            if (!toolData || typeof toolData !== "object") return null;
                            const proposal = toolData as CmsActionProposal;
                            if (!proposal.payload || !proposal.description) return null;
                            return <CmsActionConfirmation key={i} proposal={proposal} />;
                          }
                          if (part.type === "source-url" || part.type === "source-document") return null;
                          if (part.type === "tool-generate_and_upload_image") {
                            const hasOutput = "output" in part && part.output != null;
                            const output = hasOutput ? (part.output as { success?: boolean; url?: string; error?: string; prompt?: string }) : null;
                            const isSuccess = output?.success && output?.url;
                            if (!hasOutput) {
                              return (
                                <div key={i} className="flex items-center gap-2 rounded-md border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-2 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
                                  <CircleNotch className="size-3.5 shrink-0 animate-spin" />
                                  <ImageSquare className="size-3.5 shrink-0" weight="fill" />
                                  <span>Generating image…</span>
                                </div>
                              );
                            }
                            if (isSuccess) {
                              return (
                                <div key={i} className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="size-3.5 shrink-0 text-emerald-400" weight="fill" />
                                      <ImageSquare className="size-3.5 shrink-0" weight="fill" />
                                      <span>Image generated &amp; uploaded</span>
                                    </div>
                                    <a href={output.url} download={`ai-image-${Date.now()}.png`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[color:var(--framer-fresco-tint-color)] transition-colors hover:bg-[var(--framer-fresco-panelDivider-color)]">
                                      <DownloadSimple className="size-3.5" weight="bold" />
                                      <span>Download</span>
                                    </a>
                                  </div>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img alt={output.prompt ?? "AI generated image"} className="max-h-64 rounded-md border border-[var(--framer-fresco-panelDivider-color)] object-contain" src={output.url} />
                                </div>
                              );
                            }
                            return (
                              <div key={i} className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                <WarningCircle className="size-3.5 shrink-0" weight="fill" />
                                <span>{output?.error ?? "Image generation failed"}</span>
                              </div>
                            );
                          }
                          if (part.type === "tool-google_search") return null;
                          if (part.type === "tool-web_search") {
                            const hasOutput = "output" in part && part.output != null;
                            const output = hasOutput ? (part.output as { answer?: string; sources?: Array<{ url: string; title: string }> }) : null;
                            return (
                              <div key={i} className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 rounded-md border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-2 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
                                  {hasOutput ? <CheckCircle className="size-3.5 shrink-0 text-emerald-400" weight="fill" /> : <CircleNotch className="size-3.5 shrink-0 animate-spin" />}
                                  <GlobeSimple className="size-3.5 shrink-0" weight="fill" />
                                  <span>Searched the web</span>
                                </div>
                                {output?.sources && output.sources.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 pl-1">
                                    {output.sources.map((src, si) => (
                                      <a key={si} className="inline-flex max-w-48 items-center truncate rounded border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-2 py-0.5 text-[10px] text-[color:var(--framer-fresco-tint-color)] transition-colors hover:bg-[var(--framer-fresco-panelDivider-color)]" href={src.url} rel="noopener noreferrer" target="_blank">
                                        {src.title || new URL(src.url).hostname}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (part.type.startsWith("tool-")) {
                            const rawToolName = part.type.slice("tool-".length);
                            const toolName = rawToolName.replace(/_/g, " ");
                            const hasOutput = "output" in part && part.output != null;
                            const isFramerTool = rawToolName.startsWith("framer_");
                            // A tool call is "stale" if the stream finished but it never got output
                            const isStale = !hasOutput && (!isLastMessage || !isStreaming);

                            // Try rich UI for completed Framer tool calls
                            if (hasOutput) {
                              const richUI = renderFramerToolOutput(rawToolName, (part as any).output, allFieldNames);
                              if (richUI) {
                                return (
                                  <div key={i} className="mt-3 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-[10px] text-[color:var(--framer-fresco-panelDescription-color)]">
                                      <CheckCircle className="size-3 shrink-0 text-emerald-400" weight="fill" />
                                      {isFramerTool ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="33 23 75 97" className="size-3 shrink-0" aria-hidden="true">
                                          <path d="M 44.65 33.992 L 95.35 33.992 L 95.35 59.341 L 70 59.341 Z M 44.65 59.341 L 70 59.341 L 95.35 84.691 L 44.65 84.691 Z M 44.65 84.691 L 70 84.691 L 70 110.041 Z" fill="currentColor" />
                                        </svg>
                                      ) : (
                                        <Wrench className="size-3 shrink-0" />
                                      )}
                                      <span className="capitalize">{toolName}</span>
                                    </div>
                                    {richUI}
                                  </div>
                                );
                              }
                            }

                            return (
                              <div key={i} className={`mt-1 flex items-center gap-2 rounded-md border ${isStale ? "border-amber-500/30 bg-amber-500/5" : "border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)]"} px-3 py-2 text-xs text-[color:var(--framer-fresco-panelDescription-color)]`}>
                                {hasOutput ? <CheckCircle className="size-3.5 shrink-0 text-emerald-400" weight="fill" /> : isStale ? <WarningCircle className="size-3.5 shrink-0 text-amber-400" weight="fill" /> : <CircleNotch className="size-3.5 shrink-0 animate-spin" />}
                                {isFramerTool ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="33 23 75 97" className="size-3.5 shrink-0" aria-hidden="true">
                                    <path d="M 44.65 33.992 L 95.35 33.992 L 95.35 59.341 L 70 59.341 Z M 44.65 59.341 L 70 59.341 L 95.35 84.691 L 44.65 84.691 Z M 44.65 84.691 L 70 84.691 L 70 110.041 Z" fill="currentColor" />
                                  </svg>
                                ) : (
                                  <Wrench className="size-3.5 shrink-0" />
                                )}
                                <span className="capitalize">{toolName}</span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </MessageContent>
                    </Message>
                  );
                })}

                {isStreaming && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--framer-fresco-panelSubtitle-color)] [animation-delay:0ms]" />
                    <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--framer-fresco-panelSubtitle-color)] [animation-delay:150ms]" />
                    <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--framer-fresco-panelSubtitle-color)] [animation-delay:300ms]" />
                  </div>
                )}

                {error && !isStreaming && (
                  <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    <WarningCircle className="size-3.5 shrink-0" weight="fill" />
                    <span className="min-w-0 flex-1 truncate">{error.message}</span>
                    <button type="button" className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200" onClick={() => { clearError(); regenerate(); }}>
                      <ArrowClockwise className="size-3.5" weight="bold" />
                      <span>Retry</span>
                    </button>
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            {/* Input */}
            <div className="border-t border-[var(--framer-fresco-panelDivider-color)] p-4 pb-8">
              {totalTokens.total > 0 && (
                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
                  <Coins className="size-3.5 shrink-0" weight="duotone" />
                  <span>{totalTokens.total.toLocaleString()} tokens</span>
                  <span className="opacity-50">({totalTokens.input.toLocaleString()} in · {totalTokens.output.toLocaleString()} out)</span>
                </div>
              )}
              <PromptInput
                accept="image/*,application/pdf,text/plain,text/html,text/css,text/csv,text/xml,text/markdown,application/json,application/xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,audio/*,video/*"
                maxFiles={5}
                maxFileSize={10 * 1024 * 1024}
                onSubmit={async ({ text, files }) => {
                  if (!text.trim() && files.length === 0) return;
                  if (isStreaming) return;
                  sendMessage({ text, files });
                }}
              >
                <AttachmentPreviewStrip />
                {selectedPosts.length > 0 && (
                  <div className="flex w-full items-start px-3 pt-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] py-0.5 pl-2 pr-1 text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">
                      <Rows className="size-3 shrink-0" weight="bold" />
                      {selectedPosts.length} row{selectedPosts.length !== 1 ? "s" : ""} selected
                      {onClearSelection && (
                        <button
                          type="button"
                          className="ml-0.5 rounded p-0.5 transition-colors hover:bg-[var(--framer-fresco-panelDivider-color)] hover:text-[color:var(--framer-fresco-panelTitle-color)]"
                          onClick={onClearSelection}
                          aria-label="Clear selection"
                        >
                          <X className="size-3" weight="bold" />
                        </button>
                      )}
                    </span>
                  </div>
                )}
                <PromptInputTextarea placeholder={selectedPosts.length > 0 ? "Describe the changes you want…" : "Ask me anything…"} className="min-h-10 text-sm" />
                <PromptInputFooter>
                  <DirectAttachButton />
                  <PromptInputSubmit status={isStreaming ? "streaming" : "ready"} onStop={() => stop()}>
                    {isStreaming ? <Stop className="size-4" weight="fill" /> : <PaperPlaneRight className="size-4" weight="fill" />}
                  </PromptInputSubmit>
                </PromptInputFooter>
              </PromptInput>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function AIChatPanel(props: AIChatPanelProps) {
  return (
    <PromptInputProvider>
      <AIChatPanelContent {...props} />
    </PromptInputProvider>
  );
}
