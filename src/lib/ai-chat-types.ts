import type { UIMessage } from "ai";

/** Metadata attached to each assistant message via messageMetadata. */
export interface ChatMessageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface StreamDebugDataPart {
  ts: string;
  elapsedMs: number;
  chunkType: string;
  toolCallId?: string | null;
  partId?: string | null;
  toolName?: string | null;
  delta?: string | null;
}

export type AIChatMessage = UIMessage<
  ChatMessageMetadata,
  {
    stream_debug: StreamDebugDataPart;
  }
>;
