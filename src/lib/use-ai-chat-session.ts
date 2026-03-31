"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import {
  invalidateBillingUsage,
} from "@/lib/use-billing-usage";
import type {
  AIChatMessage,
  ChatMessageMetadata,
  StreamDebugDataPart,
} from "@/lib/ai-chat-types";
import {
  saveConversation,
  type SavedConversation,
} from "@/lib/chat-history";
import type { BlogPostRecord } from "@/lib/cms-types";

const AI_CHAT_SESSION_STORAGE_KEY = "lr:dashboard:ai-chat-session";

export type StreamLifecycle = {
  startedAt: number | null;
  currentStep: number;
  completedSteps: number;
  lastChunkAt: number | null;
  lastChunkType: string | null;
  activeToolName: string | null;
  toolInputErrors: Array<{
    toolCallId: string;
    toolName: string | null;
    ts: string;
  }>;
};

const INITIAL_STREAM_LIFECYCLE: StreamLifecycle = {
  startedAt: null,
  currentStep: 0,
  completedSteps: 0,
  lastChunkAt: null,
  lastChunkType: null,
  activeToolName: null,
  toolInputErrors: [],
};

type PersistedChatSession = {
  id: string;
  messages: AIChatMessage[];
  showHistory: boolean;
};

type AIChatBodyData = {
  selectedRows: Array<{
    id: string;
    slug: string;
    title: string;
    fieldValues: Record<string, unknown>;
    staged?: boolean;
    stagedId?: string;
  }>;
  fieldDefinitions: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  activeCollectionId?: string;
  activeCollectionName?: string;
};

interface UseAIChatSessionOptions {
  bodyData: AIChatBodyData;
  pendingPrompt?: string | null;
  onClearSelection?: () => void;
  onPendingPromptConsumed?: () => void;
  selectedPosts: BlogPostRecord[];
  textInput: { clear: () => void };
}

function readPersistedChatSession(): PersistedChatSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AI_CHAT_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedChatSession>;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }

    return {
      id: parsed.id,
      messages: parsed.messages as AIChatMessage[],
      showHistory: parsed.showHistory === true,
    };
  } catch {
    return null;
  }
}

function writePersistedChatSession(session: PersistedChatSession) {
  window.localStorage.setItem(
    AI_CHAT_SESSION_STORAGE_KEY,
    JSON.stringify(session),
  );
}

function clearPersistedChatSession() {
  window.localStorage.removeItem(AI_CHAT_SESSION_STORAGE_KEY);
}

function isRecoverableToolProtocolError(message: string) {
  return /tool result is missing for tool call/i.test(message);
}

function sanitizeMessagesForTransport(
  messages: AIChatMessage[],
  bodyData: AIChatBodyData,
  sendSnapshotRef: MutableRefObject<AIChatBodyData | null>,
) {
  const MAX_TOOL_RESULT_CHARS = 2000;
  const MAX_FILE_URL_LEN = 50_000;
  let lastUserIdx = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  const sanitized = messages.map((msg, idx) => {
    if (!Array.isArray(msg.parts)) {
      return msg;
    }

    let needsWork = false;
    for (const part of msg.parts) {
      if (
        part.type === "tool-invocation" &&
        "state" in part &&
        (part as any).state !== "output-available" &&
        (part as any).state !== "output-error"
      ) {
        needsWork = true;
        break;
      }

      if (
        part.type === "tool-invocation" &&
        "result" in part &&
        part.result !== undefined &&
        JSON.stringify(part.result).length > MAX_TOOL_RESULT_CHARS
      ) {
        needsWork = true;
        break;
      }

      if (
        idx !== lastUserIdx &&
        part.type === "file" &&
        "url" in part &&
        typeof part.url === "string" &&
        part.url.length > MAX_FILE_URL_LEN
      ) {
        needsWork = true;
        break;
      }
    }

    if (!needsWork) {
      return msg;
    }

    return {
      ...msg,
      parts: msg.parts.map((part) => {
        if (
          part.type === "tool-invocation" &&
          "state" in part &&
          (part as any).state !== "output-available" &&
          (part as any).state !== "output-error"
        ) {
          return {
            ...part,
            state: "output-available" as const,
            output: {
              _cancelled: true,
              message: "Tool call was cancelled by the user.",
            },
          };
        }

        if (
          part.type === "tool-invocation" &&
          "result" in part &&
          part.result !== undefined
        ) {
          const stringified = JSON.stringify(part.result);
          if (stringified.length > MAX_TOOL_RESULT_CHARS) {
            return {
              ...part,
              result: {
                _truncated: true,
                preview: stringified.slice(0, MAX_TOOL_RESULT_CHARS),
              },
            };
          }
        }

        if (
          idx !== lastUserIdx &&
          part.type === "file" &&
          "url" in part &&
          typeof part.url === "string" &&
          part.url.length > MAX_FILE_URL_LEN
        ) {
          return {
            type: "text" as const,
            text: `[User attached an image: ${("filename" in part && part.filename) || "image"}]`,
          };
        }

        return part;
      }),
    };
  });

  return {
    body: {
      ...(sendSnapshotRef.current || bodyData),
      messages: sanitized,
    },
  };
}

export function useAIChatSession({
  bodyData,
  pendingPrompt,
  onClearSelection,
  onPendingPromptConsumed,
  selectedPosts,
  textInput,
}: UseAIChatSessionOptions) {
  const initialSessionRef = useRef<PersistedChatSession | null | undefined>(
    undefined,
  );
  if (
    initialSessionRef.current === undefined &&
    typeof window !== "undefined"
  ) {
    initialSessionRef.current = readPersistedChatSession();
  }

  const [chatKey, setChatKey] = useState(
    () => initialSessionRef.current?.id ?? crypto.randomUUID(),
  );
  const [showHistory, setShowHistory] = useState(
    () => initialSessionRef.current?.showHistory ?? false,
  );
  const [rawToolInputs, setRawToolInputs] = useState<
    Record<string, { text: string; toolName?: string | null }>
  >({});
  const [toolTimingByCallId, setToolTimingByCallId] = useState<
    Record<
      string,
      {
        firstSeenAt: string;
        firstSeenElapsedMs: number;
        lastSeenElapsedMs: number;
        finishedElapsedMs?: number;
        finishedReason?: "output-available" | "output-error" | "input-error" | "output-denied";
        toolName?: string | null;
      }
    >
  >({});
  const [streamLifecycle, setStreamLifecycle] = useState<StreamLifecycle>(
    INITIAL_STREAM_LIFECYCLE,
  );
  const [messageContexts, setMessageContexts] = useState<
    Record<string, Array<{ id: string; title: string }>>
  >({});

  const sendSnapshotRef = useRef<AIChatBodyData | null>(null);
  const pendingContextRef = useRef<Array<{ id: string; title: string }> | null>(
    null,
  );
  const recoverableRetryUserIdsRef = useRef<Set<string>>(new Set());
  const consumedPromptRef = useRef<string | null>(null);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: ({
          id,
          messages,
          trigger,
          messageId,
        }) => {
          const prepared = sanitizeMessagesForTransport(
            messages as AIChatMessage[],
            bodyData,
            sendSnapshotRef,
          );

          return {
            body: {
              ...prepared.body,
              id,
              trigger,
              messageId,
            },
          };
        },
      }),
    [bodyData],
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    error,
    regenerate,
    clearError,
    addToolApprovalResponse,
  } = useChat<AIChatMessage>({
    transport: chatTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onData: (dataPart) => {
      if (dataPart.type !== "data-stream_debug") {
        return;
      }

      const event = dataPart.data as StreamDebugDataPart;
      console.log(
        JSON.stringify({
          ts: event.ts,
          level: "info",
          event: "ai.chat_panel.stream_debug",
          chunkType: event.chunkType,
          elapsedMs: event.elapsedMs,
          toolCallId: event.toolCallId ?? undefined,
          toolName: event.toolName ?? undefined,
        }),
      );

      // Update stream lifecycle on every debug event
      const now = Date.now();
      setStreamLifecycle((current) => {
        const next = { ...current };
        if (next.startedAt === null) {
          next.startedAt = now;
        }
        next.lastChunkAt = now;
        next.lastChunkType = event.chunkType;

        if (event.chunkType === "start-step") {
          next.currentStep = current.currentStep + 1;
        } else if (event.chunkType === "finish-step") {
          next.completedSteps = current.completedSteps + 1;
        } else if (event.chunkType === "tool-input-start" && event.toolName) {
          next.activeToolName = event.toolName;
        } else if (
          event.chunkType === "tool-output-available" ||
          event.chunkType === "tool-output-error" ||
          event.chunkType === "tool-output-denied"
        ) {
          next.activeToolName = null;
        } else if (event.chunkType === "tool-input-error") {
          next.activeToolName = null;
          next.toolInputErrors = [
            ...current.toolInputErrors,
            {
              toolCallId: event.toolCallId ?? "",
              toolName: event.toolName ?? null,
              ts: event.ts,
            },
          ];
        }
        return next;
      });

      if (!event.toolCallId) {
        return;
      }

      const finishedReason =
        event.chunkType === "tool-output-available"
          ? ("output-available" as const)
          : event.chunkType === "tool-output-error"
            ? ("output-error" as const)
            : event.chunkType === "tool-output-denied"
              ? ("output-denied" as const)
              : event.chunkType === "tool-input-error"
                ? ("input-error" as const)
                : undefined;

      setToolTimingByCallId((current) => {
        const existing = current[event.toolCallId!];
        return {
          ...current,
          [event.toolCallId!]: {
            firstSeenAt: existing?.firstSeenAt ?? event.ts,
            firstSeenElapsedMs:
              existing?.firstSeenElapsedMs ?? event.elapsedMs,
            lastSeenElapsedMs: event.elapsedMs,
            finishedElapsedMs:
              event.chunkType === "tool-output-available" ||
              event.chunkType === "tool-output-error" ||
              event.chunkType === "tool-output-denied" ||
              event.chunkType === "tool-input-error"
                ? event.elapsedMs
                : existing?.finishedElapsedMs,
            finishedReason: finishedReason ?? existing?.finishedReason,
            toolName: existing?.toolName ?? event.toolName ?? null,
          },
        };
      });

      if (event.delta) {
        setRawToolInputs((current) => {
          const existing = current[event.toolCallId!] ?? {
            text: "",
            toolName: event.toolName ?? null,
          };
          return {
            ...current,
            [event.toolCallId!]: {
              toolName: existing.toolName ?? event.toolName ?? null,
              text: `${existing.text}${event.delta ?? ""}`.slice(-20000),
            },
          };
        });
      } else if (event.toolName) {
        setRawToolInputs((current) => {
          const existing = current[event.toolCallId!];
          if (existing?.toolName === event.toolName) {
            return current;
          }

          return {
            ...current,
            [event.toolCallId!]: {
              text: existing?.text ?? "",
              toolName: event.toolName,
            },
          };
        });
      }
    },
    onError: (nextError) => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "error",
          event: "ai.chat_panel.error",
          message: nextError.message,
        }),
      );
    },
  });

  useEffect(() => {
    const initialSession = initialSessionRef.current;
    if (!initialSession || initialSession.messages.length === 0) {
      return;
    }

    setMessages(initialSession.messages);
    initialSessionRef.current = null;
  }, [setMessages]);

  useEffect(() => {
    if (!pendingPrompt || status !== "ready") {
      return;
    }

    // Guard against double-fire: if this exact prompt was already consumed,
    // skip. React Strict Mode or rapid re-renders can trigger this effect
    // twice with the same pendingPrompt before the parent clears it.
    if (consumedPromptRef.current === pendingPrompt) {
      return;
    }

    consumedPromptRef.current = pendingPrompt;
    sendMessage({ text: pendingPrompt });
    onPendingPromptConsumed?.();
  }, [onPendingPromptConsumed, pendingPrompt, sendMessage, status]);

  useEffect(() => {
    if (!error || !isRecoverableToolProtocolError(error.message)) {
      return;
    }

    let lastUserId: string | null = null;
    let lastAssistantId: string | null = null;

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (!lastAssistantId && message.role === "assistant") {
        lastAssistantId = message.id;
      }
      if (message.role === "user") {
        lastUserId = message.id;
        break;
      }
    }

    if (!lastUserId || recoverableRetryUserIdsRef.current.has(lastUserId)) {
      return;
    }

    recoverableRetryUserIdsRef.current.add(lastUserId);
    clearError();
    void regenerate(lastAssistantId ? { messageId: lastAssistantId } : undefined);
  }, [clearError, error, messages, regenerate]);

  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (
      messages.length > prevMessageCountRef.current &&
      pendingContextRef.current
    ) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          const context = pendingContextRef.current;
          setMessageContexts((current) => ({
            ...current,
            [messages[i].id]: context,
          }));
          pendingContextRef.current = null;
          break;
        }
      }
    }

    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const handleSendWithContext = useCallback(
    (message: { text: string }) => {
      recoverableRetryUserIdsRef.current.clear();
      setStreamLifecycle(INITIAL_STREAM_LIFECYCLE);

      if (selectedPosts.length > 0) {
        pendingContextRef.current = selectedPosts.map((post) => ({
          id: post.id,
          title: post.title || post.slug,
        }));
      }

      sendSnapshotRef.current = bodyData;
      sendMessage(message);

      if (selectedPosts.length > 0) {
        onClearSelection?.();
      }
    },
    [bodyData, onClearSelection, selectedPosts, sendMessage],
  );

  const totalTokens = useMemo(() => {
    let input = 0;
    let output = 0;

    for (const message of messages) {
      const metadata = message.metadata as ChatMessageMetadata | undefined;
      if (metadata?.inputTokens) {
        input += metadata.inputTokens;
      }
      if (metadata?.outputTokens) {
        output += metadata.outputTokens;
      }
    }

    return { input, output, total: input + output };
  }, [messages]);

  const handleNewChat = useCallback(() => {
    if (messages.length > 0) {
      void saveConversation(chatKey, messages);
    }

    clearError();
    setMessages([]);
    textInput.clear();
    setChatKey(crypto.randomUUID());
    setShowHistory(false);
    setRawToolInputs({});
    setToolTimingByCallId({});
    setMessageContexts({});
    setStreamLifecycle(INITIAL_STREAM_LIFECYCLE);
    recoverableRetryUserIdsRef.current.clear();
    clearPersistedChatSession();
  }, [chatKey, clearError, messages, setMessages, textInput]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasActive =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    const nowIdle = status === "ready" || status === "error";

    if (wasActive && nowIdle && messages.length > 0) {
      void saveConversation(chatKey, messages);
      invalidateBillingUsage();
    }

    prevStatusRef.current = status;
  }, [chatKey, messages, status]);

  useEffect(() => {
    if (messages.length === 0) {
      if (!showHistory) {
        clearPersistedChatSession();
      }
      setRawToolInputs({});
      setToolTimingByCallId({});
      setMessageContexts({});
      setStreamLifecycle(INITIAL_STREAM_LIFECYCLE);
      return;
    }

    if (status === "streaming" || status === "submitted") {
      return;
    }

    writePersistedChatSession({
      id: chatKey,
      messages,
      showHistory,
    });
  }, [chatKey, messages, showHistory, status]);

  const handleRestoreConversation = useCallback(
    (conversation: SavedConversation) => {
      if (messages.length > 0) {
        void saveConversation(chatKey, messages);
      }

      clearError();
      setMessages(conversation.messages as AIChatMessage[]);
      textInput.clear();
      setChatKey(conversation.id);
      setShowHistory(false);
      setRawToolInputs({});
      setToolTimingByCallId({});
      setMessageContexts({});
      setStreamLifecycle(INITIAL_STREAM_LIFECYCLE);
      recoverableRetryUserIdsRef.current.clear();
    },
    [chatKey, clearError, messages, setMessages, textInput],
  );

  return {
    addToolApprovalResponse,
    chatKey,
    clearError,
    error,
    handleNewChat,
    handleRestoreConversation,
    handleSendWithContext,
    isStreaming: status === "streaming" || status === "submitted",
    messageContexts,
    messages,
    rawToolInputs,
    regenerate,
    setShowHistory,
    showHistory,
    status,
    stop,
    streamLifecycle,
    toolTimingByCallId,
    totalTokens,
  };
}
