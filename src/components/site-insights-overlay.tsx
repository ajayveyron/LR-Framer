"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Lightbulb,
  X,
  ImageSquare,
  ArrowRight,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import type { BlogCollectionMetadata, BlogPostRecord } from "@/lib/cms-types";
import { scanSiteInsights, type SiteInsight } from "@/lib/content-nudges";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "lr:dashboard:insights-dismissed";
const SIDEBAR_SLOT_ID = "sidebar-insights-slot";

function getDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissedIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable
  }
}

const SEVERITY_ICON: Record<string, typeof ImageSquare> = {
  "missing-alt-text": ImageSquare,
};

interface SiteInsightsOverlayProps {
  posts: BlogPostRecord[];
  metadata: BlogCollectionMetadata;
  onFixInsight: (prompt: string) => void;
}

function InsightCard({
  insight,
  onFix,
  onDismiss,
}: {
  insight: SiteInsight;
  onFix: () => void;
  onDismiss: () => void;
}) {
  const Icon = SEVERITY_ICON[insight.id] ?? Lightbulb;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-dash-control-border bg-dash-control-bg p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
          insight.severity === "warning"
            ? "bg-fresco-warning-callout-bg text-fresco-warning-callout-text"
            : "bg-[color-mix(in_srgb,var(--color-fresco-tint)_14%,transparent)] text-fresco-tint",
        )}
      >
        <Icon className="size-4" weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-fresco-title">
          {insight.title}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-fresco-description">
          {insight.description}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <Button
            className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-medium"
            onClick={onFix}
            size="sm"
            type="button"
            variant="default"
          >
            Fix with AI
            <ArrowRight className="size-3" weight="bold" />
          </Button>
          <Button
            className="h-7 rounded-lg px-2.5 text-[11px] font-medium text-fresco-subtitle"
            onClick={onDismiss}
            size="sm"
            type="button"
            variant="ghost"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

function InsightsModal({
  visibleInsights,
  onFixInsight,
  onDismiss,
  onClose,
}: {
  visibleInsights: SiteInsight[];
  onFixInsight: (prompt: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  const handleFix = useCallback(
    (insight: SiteInsight) => {
      onClose();
      onFixInsight(insight.prompt);
    },
    [onFixInsight, onClose],
  );

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-[380px] max-h-[80vh] overflow-y-auto",
          "rounded-2xl border border-dash-control-border bg-[#141415] p-3 shadow-2xl",
        )}
        role="dialog"
        aria-label="Site Insights"
      >
        <div className="flex items-center justify-between px-1 pb-2.5 pt-1">
          <span className="text-[13px] font-medium text-fresco-title">
            Site Insights
          </span>
          <button
            aria-label="Close insights"
            className="inline-flex size-7 items-center justify-center rounded-lg text-fresco-subtitle transition-colors hover:bg-dash-control-hover hover:text-fresco-title"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" weight="bold" />
          </button>
        </div>
        <div className="grid gap-2">
          {visibleInsights.map((insight) => (
            <InsightCard
              insight={insight}
              key={insight.id}
              onDismiss={() => onDismiss(insight.id)}
              onFix={() => handleFix(insight)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InsightsPillContent({
  visibleInsights,
  onFixInsight,
  onDismiss,
}: {
  visibleInsights: SiteInsight[];
  onFixInsight: (prompt: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={`${visibleInsights.length} site insight${visibleInsights.length === 1 ? "" : "s"}`}
        className={cn(
          "inline-flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-medium tracking-[-0.01em] transition-colors",
          "border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]",
          "hover:bg-dash-control-hover hover:text-fresco-title",
          open && "bg-dash-control-hover text-fresco-title",
        )}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Lightbulb className="size-4 shrink-0" weight="duotone" />
        <span className="flex-1 text-left">
          {visibleInsights.length} insight{visibleInsights.length === 1 ? "" : "s"}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex size-1.5 shrink-0 rounded-full bg-fresco-warning-callout-text"
        />
      </button>

      {open && (
        <InsightsModal
          onClose={() => setOpen(false)}
          onDismiss={onDismiss}
          onFixInsight={onFixInsight}
          visibleInsights={visibleInsights}
        />
      )}
    </>
  );
}

export function SiteInsightsPill({
  posts,
  metadata,
  onFixInsight,
}: SiteInsightsOverlayProps) {
  const [dismissedIds, setDismissedIds] = useState(getDismissedIds);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById(SIDEBAR_SLOT_ID));
  }, []);

  const allInsights = useMemo(
    () => scanSiteInsights(posts, metadata),
    [posts, metadata],
  );

  const visibleInsights = useMemo(
    () => allInsights.filter((i) => !dismissedIds.has(i.id)),
    [allInsights, dismissedIds],
  );

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDismissedIds(next);
      return next;
    });
  }, []);

  if (visibleInsights.length === 0) return null;

  // Portal into the sidebar slot on desktop; render inline as fallback (mobile)
  if (portalTarget) {
    return createPortal(
      <InsightsPillContent
        onDismiss={handleDismiss}
        onFixInsight={onFixInsight}
        visibleInsights={visibleInsights}
      />,
      portalTarget,
    );
  }

  // Fallback: render inline (mobile or if sidebar slot not found)
  return (
    <InsightsPillContent
      onDismiss={handleDismiss}
      onFixInsight={onFixInsight}
      visibleInsights={visibleInsights}
    />
  );
}
