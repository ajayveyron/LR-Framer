import type { UIMessage } from "ai";

export interface SavedConversation {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
}

/** Derive a title from the first user message */
function deriveTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Untitled conversation";
  const text = first.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
  return text.length > 80 ? text.slice(0, 77) + "…" : text || "Untitled conversation";
}

/** Save or update a conversation (fire-and-forget safe). */
export async function saveConversation(id: string, messages: UIMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    await fetch("/api/ai/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: id,
        title: deriveTitle(messages),
        messages: JSON.stringify(messages),
      }),
    });
  } catch {
    // Fire-and-forget — don't break the chat experience
  }
}

/** List all saved conversations, newest first. */
export async function listConversations(): Promise<SavedConversation[]> {
  try {
    const res = await fetch("/api/ai/chat/history");
    if (!res.ok) return [];
    const data = (await res.json()) as {
      conversations: Array<{
        conversationId: string;
        title: string;
        messages: string;
        createdAt: number;
        updatedAt: number;
      }>;
    };
    return data.conversations.map((c) => ({
      id: c.conversationId,
      title: c.title,
      messages: JSON.parse(c.messages) as UIMessage[],
      createdAt: new Date(c.createdAt).toISOString(),
      updatedAt: new Date(c.updatedAt).toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Delete a conversation by id. */
export async function deleteConversation(id: string): Promise<void> {
  try {
    await fetch(`/api/ai/chat/history/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    // Fire-and-forget
  }
}
