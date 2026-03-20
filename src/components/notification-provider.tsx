"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type NotificationTone = "success" | "error";

interface NotificationItem {
  id: number;
  message: string;
  tone: NotificationTone;
}

interface NotificationApi {
  error: (message: string) => void;
  success: (message: string) => void;
}

const NotificationContext = createContext<NotificationApi | null>(null);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const push = useCallback((tone: NotificationTone, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setItems((current) => [...current, { id, message, tone }]);

    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const value = useMemo<NotificationApi>(
    () => ({
      error: (message) => push("error", message),
      success: (message) => push("success", message),
    }),
    [push],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="fixed top-6 right-6 z-[1000] grid w-[min(360px,calc(100vw-32px))] gap-2.5"
      >
        {items.map((item) => (
          <div
            className={cn(
              "border px-4 py-3 text-sm shadow-lg backdrop-blur-xl",
              item.tone === "success"
                ? "rounded-none border border-[var(--framer-app-success-callout-border-color)] bg-[var(--framer-app-success-callout-background-color)] px-4 py-3 text-sm text-[color:var(--framer-app-success-callout-text-color)]"
                : "rounded-none border border-[var(--framer-app-danger-callout-border-color)] bg-[var(--framer-app-danger-callout-background-color)] px-4 py-3 text-sm text-[color:var(--framer-app-danger-callout-text-color)]",
            )}
            key={item.id}
            role="status"
          >
            {item.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotify must be used within NotificationProvider");
  }

  return context;
}
