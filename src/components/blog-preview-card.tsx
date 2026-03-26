"use client";

import { Article, Copy, CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useState, useCallback, type ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type BlogPreviewCardProps = ComponentProps<"div"> & {
  title: string;
  content: string;
  slug?: string;
  status?: "draft" | "published";
};

export function BlogPreviewCard({
  title,
  content,
  slug,
  status,
  className,
  ...props
}: BlogPreviewCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-fresco-divider/60 bg-fresco-surface-muted/40",
        className,
      )}
      {...props}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-fresco-divider/40 px-4 py-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-fresco-tint)_12%,transparent)]">
          <Article className="size-3.5 text-fresco-tint" weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-fresco-title">
              {title}
            </span>
            {status && (
              <Badge
                variant="secondary"
                className="shrink-0 rounded-full text-[10px] px-2 py-0"
              >
                {status === "draft" ? "Draft" : "Published"}
              </Badge>
            )}
          </div>
          {slug && (
            <span className="text-[11px] text-fresco-subtitle">/{slug}</span>
          )}
        </div>
        <Button
          aria-label="Copy content"
          className="size-7 shrink-0"
          onClick={handleCopy}
          size="icon-sm"
          title="Copy content"
          type="button"
          variant="ghost"
        >
          {copied ? (
            <CheckCircle className="size-3.5 text-fresco-success" weight="fill" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="max-h-[420px] overflow-y-auto px-4 py-4">
        <div
          className="framer-editor-prose"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
