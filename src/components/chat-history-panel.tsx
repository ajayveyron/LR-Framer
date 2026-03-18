"use client";

import { ClockCounterClockwise, Trash, ArrowLeft } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  listConversations,
  deleteConversation,
  type SavedConversation,
} from "@/lib/chat-history";

interface ChatHistoryPanelProps {
  onSelect: (conversation: SavedConversation) => void;
  onBack: () => void;
}

export function ChatHistoryPanel({ onSelect, onBack }: ChatHistoryPanelProps) {
  const [conversations, setConversations] = useState<SavedConversation[]>(() => listConversations());

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    },
    [],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--framer-fresco-panelDivider-color)] px-4 py-3">
        <Button
          aria-label="Back to chat"
          className="size-8 shrink-0"
          onClick={onBack}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <ClockCounterClockwise
          className="size-5 shrink-0 text-[color:var(--framer-fresco-tint-color)]"
          weight="duotone"
        />
        <span className="text-sm font-semibold">Chat History</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <ClockCounterClockwise
              className="size-8 text-[color:var(--framer-fresco-panelSubtitle-color)]"
              weight="duotone"
            />
            <p className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
              No past conversations yet
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--framer-fresco-panelDivider-color)]">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--framer-app-surface-muted-color)]"
                  onClick={() => onSelect(conv)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
                      {conv.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
                      {conv.messages.length} message{conv.messages.length !== 1 ? "s" : ""} · {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                    onClick={(e) => handleDelete(e, conv.id)}
                  >
                    <Trash className="size-3.5" />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
