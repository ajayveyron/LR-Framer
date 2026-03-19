import type { UIMessage } from "ai";

/** Metadata attached to each assistant message via messageMetadata. */
export interface ChatMessageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type AIChatMessage = UIMessage<ChatMessageMetadata>;
