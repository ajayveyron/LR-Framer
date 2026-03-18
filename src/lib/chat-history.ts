import type { UIMessage } from "ai";

const STORAGE_KEY = "lr-chat-history";
const MAX_CONVERSATIONS = 50;

export interface SavedConversation {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
}

function getStorage(): SavedConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedConversation[]) : [];
  } catch {
    return [];
  }
}

function setStorage(conversations: SavedConversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full — drop oldest conversations and retry
    const trimmed = conversations.slice(0, Math.floor(conversations.length / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Give up silently
    }
  }
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

/** Save or update a conversation. Call after each assistant response. */
export function saveConversation(id: string, messages: UIMessage[]): void {
  if (messages.length === 0) return;
  const all = getStorage();
  const now = new Date().toISOString();
  const existing = all.find((c) => c.id === id);

  if (existing) {
    existing.messages = messages;
    existing.title = deriveTitle(messages);
    existing.updatedAt = now;
  } else {
    all.unshift({
      id,
      title: deriveTitle(messages),
      messages,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Keep list capped
  setStorage(all.slice(0, MAX_CONVERSATIONS));
}

/** List all saved conversations, newest first. */
export function listConversations(): SavedConversation[] {
  return getStorage().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Load a single conversation by id. */
export function loadConversation(id: string): SavedConversation | undefined {
  return getStorage().find((c) => c.id === id);
}

/** Delete a conversation by id. */
export function deleteConversation(id: string): void {
  setStorage(getStorage().filter((c) => c.id !== id));
}
