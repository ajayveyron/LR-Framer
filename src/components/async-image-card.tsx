"use client";

import {
  ImageSquare,
  SpinnerGap,
  DownloadSimple,
  Warning,
  Copy,
  Check,
} from "@phosphor-icons/react";
import { useState } from "react";

import { ToolCallRow } from "@/components/ai-elements/tool";
import { useImageJob } from "@/lib/use-image-job";

interface AsyncImageCardProps {
  jobId: string;
  prompt: string;
}

/**
 * Renders a live-updating card for a background image generation job.
 * Polls the job status and transitions through pending → running → completed/failed.
 */
export function AsyncImageCard({ jobId, prompt }: AsyncImageCardProps) {
  const job = useImageJob(jobId);
  const [copied, setCopied] = useState(false);
  const [downloadName] = useState(() => `ai-image-${Date.now()}.png`);

  const handleCopyUrl = () => {
    if (!job?.url) return;
    navigator.clipboard.writeText(job.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = job?.status ?? "pending";

  if (status === "completed" && job?.url) {
    return (
      <ToolCallRow
        actions={
          <div className="flex items-center gap-1">
            <button
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-fresco-tint transition-colors hover:bg-fresco-divider"
              onClick={handleCopyUrl}
              title="Copy image URL"
              type="button"
            >
              {copied ? (
                <Check className="size-3.5" weight="bold" />
              ) : (
                <Copy className="size-3.5" weight="bold" />
              )}
              <span>{copied ? "Copied" : "Copy URL"}</span>
            </button>
            <a
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-fresco-tint transition-colors hover:bg-fresco-divider"
              download={downloadName}
              href={job.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <DownloadSimple className="size-3.5" weight="bold" />
              <span>Download</span>
            </a>
          </div>
        }
        icon={<ImageSquare className="size-3.5" weight="fill" />}
        label="Generate image"
        status="Done"
        summary="Image generated and uploaded."
        tone="success"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={prompt ?? "AI generated image"}
          className="max-h-64 rounded-xl border border-fresco-divider object-contain"
          src={job.url}
        />
      </ToolCallRow>
    );
  }

  if (status === "failed") {
    return (
      <ToolCallRow
        icon={<Warning className="size-3.5" weight="fill" />}
        label="Generate image"
        status="Error"
        summary={job?.error ?? "Image generation failed"}
        tone="danger"
      />
    );
  }

  // pending or running
  return (
    <ToolCallRow
      icon={<SpinnerGap className="size-3.5 animate-spin" weight="bold" />}
      label="Generate image"
      shimmer
      status={status === "running" ? "Generating" : "Queued"}
      summary={
        status === "running"
          ? "Creating image using Nano Banana Pro, it can take some time."
          : "Image generation queued. Starting shortly."
      }
      tone="accent"
    />
  );
}
