"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

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
      <div className="notification-stack" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div
            className={`notification notification-${item.tone}`}
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
