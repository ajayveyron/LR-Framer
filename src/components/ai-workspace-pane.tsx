"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

interface AIWorkspacePaneProps {
  children: ReactNode;
  open: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

function clampWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(Math.max(width, minWidth), maxWidth);
}

export function AIWorkspacePane({
  children,
  open,
  width,
  onWidthChange,
  minWidth = 380,
  maxWidth = 760,
  className,
}: AIWorkspacePaneProps) {
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const [isResizing, setIsResizing] = useState(false);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const viewportMaxWidth = Math.max(
        minWidth,
        Math.min(maxWidth, Math.floor(window.innerWidth * 0.5)),
      );
      const deltaX = event.clientX - dragState.startX;
      const nextWidth = clampWidth(
        dragState.startWidth - deltaX,
        minWidth,
        viewportMaxWidth,
      );
      onWidthChange(nextWidth);
    },
    [maxWidth, minWidth, onWidthChange],
  );

  const stopResizing = useCallback(() => {
    dragStateRef.current = null;
    setIsResizing(false);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
    };
  }, [handlePointerMove, isResizing, stopResizing]);

  useEffect(() => stopResizing, [stopResizing]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragStateRef.current = { startX: event.clientX, startWidth: width };
      setIsResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "relative shrink-0 overflow-hidden border-l border-dash-content-border bg-fresco-panel transition-[width] duration-200 ease-out",
        !open && "pointer-events-none border-l-transparent",
        className,
      )}
      style={{ width: open ? `${width}px` : "0px" }}
    >
      {open ? (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-20 w-3 -translate-x-1/2 cursor-col-resize"
          onPointerDown={handlePointerDown}
        >
          <div
            className={cn(
              "mx-auto h-full w-px bg-dash-content-border/70 transition-colors",
              isResizing && "bg-fresco-tint",
            )}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-col",
          !open && "invisible",
        )}
      >
        {children}
      </div>
    </aside>
  );
}
