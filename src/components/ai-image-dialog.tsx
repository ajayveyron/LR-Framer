"use client";

import { useState } from "react";
import {
  Sparkle,
  SpinnerGap,
  ArrowCounterClockwise,
  Check,
  Image as ImageIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { generateAIImage, buildAltText, buildDefaultPrompt } from "@/lib/ai-image-prompt";
import { logEvent, logError } from "@/lib/logger";

interface AIImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the image URL and alt text when the user accepts. */
  onAccept: (imageUrl: string, altText: string) => void;
  /** Optional CMS context to enrich the prompt. */
  context?: {
    title?: string;
    slug?: string;
    bodyText?: string;
  };
  /** Pre-populated prompt text. */
  defaultPrompt?: string;
  /** Existing image URL to use as a reference for generation. */
  referenceImageUrl?: string;
}

export function AIImageDialog({
  open,
  onOpenChange,
  onAccept,
  context,
  defaultPrompt = "",
  referenceImageUrl,
}: AIImageDialogProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{
    dataUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleGenerate() {
    const effectivePrompt = prompt.trim() || buildDefaultPrompt(context);
    setGenerating(true);
    setError(null);
    setPreview(null);

    logEvent("info", "ai.image_dialog.generate_requested", {
      promptLength: effectivePrompt.length,
      usedTemplate: !prompt.trim(),
      hasContext: Boolean(context),
      hasReferenceImage: Boolean(referenceImageUrl),
    });

    try {
      const result = await generateAIImage(effectivePrompt, context, referenceImageUrl);
      const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
      setPreview({ dataUrl, base64: result.imageBase64, mimeType: result.mimeType });
      // If user left prompt empty, fill it with what was actually sent
      if (!prompt.trim()) setPrompt(effectivePrompt);

      logEvent("info", "ai.image_dialog.generate_completed", { success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed.";
      setError(message);
      logError("ai.image_dialog.generate_failed", err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAccept() {
    if (!preview) return;
    setUploading(true);
    setError(null);

    try {
      // Convert base64 to File and upload via /api/uploads
      const byteString = atob(preview.base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const ext = preview.mimeType.split("/")[1] ?? "png";
      const file = new File([ab], `ai-generated.${ext}`, { type: preview.mimeType });

      const body = new FormData();
      body.set("file", file);
      body.set("kind", "image");

      const response = await fetch("/api/uploads", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Upload failed.");
      }

      const altText = buildAltText(prompt);
      logEvent("info", "ai.image_dialog.accepted", { altText });
      onAccept(data.url, altText);
      handleReset();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      logError("ai.image_dialog.upload_failed", err);
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setPrompt(defaultPrompt);
    setPreview(null);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkle
              className="size-5 text-[color:var(--framer-fresco-tint-color)]"
              weight="duotone"
            />
            Generate Image with AI
          </DialogTitle>
          <DialogDescription>
            Describe the image you want. CMS content is used as additional context.
          </DialogDescription>
        </DialogHeader>

        {/* Context preview */}
        {context?.title && (
          <div className="rounded-md border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-2 text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
            <span className="font-medium text-[color:var(--framer-fresco-panelSubtitle-color)]">Context:</span>{" "}
            {context.title}
            {context.slug && ` · /${context.slug}`}
          </div>
        )}

        {/* Reference image indicator */}
        {referenceImageUrl && (
          <div className="flex items-center gap-2.5 rounded-md border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Current thumbnail"
              className="size-8 shrink-0 rounded object-cover"
              src={referenceImageUrl}
            />
            <span className="text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
              Using current thumbnail as reference
            </span>
          </div>
        )}

        <Textarea
          className="min-h-20 resize-none text-sm"
          disabled={generating || uploading}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A modern blog header illustration showing…"
          value={prompt}
        />

        {/* Preview */}
        {preview && (
          <div className="relative overflow-hidden rounded-lg border border-[var(--framer-fresco-panelDivider-color)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="AI generated preview"
              className="w-full object-contain"
              src={preview.dataUrl}
            />
          </div>
        )}

        {/* Empty state */}
        {!preview && !generating && !error && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--framer-fresco-panelDivider-color)] py-10 text-[color:var(--framer-fresco-panelSubtitle-color)]">
            <ImageIcon className="size-8" weight="duotone" />
            <span className="text-xs">Your generated image will appear here</span>
          </div>
        )}

        {/* Loading */}
        {generating && (
          <div className="flex items-center justify-center gap-2 py-10 text-[color:var(--framer-fresco-panelSubtitle-color)]">
            <SpinnerGap className="size-6 animate-spin" />
            <span className="text-sm">Generating…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {preview && (
            <>
              <Button
                disabled={generating || uploading}
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <ArrowCounterClockwise className="size-4" />
                Regenerate
              </Button>
              <Button
                disabled={uploading}
                onClick={handleAccept}
                size="sm"
                type="button"
              >
                {uploading ? (
                  <>
                    <SpinnerGap className="size-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Use Image
                  </>
                )}
              </Button>
            </>
          )}

          {!preview && !generating && (
            <Button
              disabled={false}
              onClick={handleGenerate}
              size="sm"
              type="button"
            >
              <Sparkle className="size-4" weight="duotone" />
              Generate
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
