"use client";

import { useCallback, useRef, useState } from "react";

import type { BlogPostRecord } from "@/lib/cms-types";
import { getCollectionHeader } from "@/lib/product-framer-shared";

type SetCachedPosts = (updater: (current: BlogPostRecord[]) => BlogPostRecord[]) => void;

/** Pending undo state for a destructive action */
export interface UndoPending {
  id: string;
  label: string;
  undo: () => void;
  expiresAt: number;
}

const UNDO_WINDOW_MS = 5_000;

function upsertPost(posts: BlogPostRecord[], next: BlogPostRecord) {
  const remaining = posts.filter((p) => p.id !== next.id);
  return [...remaining, next].sort((a, b) => {
    const aDate = a.lastUpdated ?? a.createdAt ?? "";
    const bDate = b.lastUpdated ?? b.createdAt ?? "";
    return bDate > aDate ? 1 : bDate < aDate ? -1 : 0;
  });
}

interface UseCmsMutationsOptions {
  activeCollectionId: string;
  setCachedPosts: SetCachedPosts;
}

export function useCmsMutations({
  activeCollectionId,
  setCachedPosts,
}: UseCmsMutationsOptions) {
  const [loadingPosts, setLoadingPosts] = useState<Set<string>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);
  const [undoPending, setUndoPending] = useState<UndoPending | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markLoading = useCallback((id: string) => {
    setLoadingPosts((prev) => new Set(prev).add(id));
  }, []);

  const unmarkLoading = useCallback((id: string) => {
    setLoadingPosts((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ── Push staged item to Framer ──
  const pushStagedItem = useCallback(
    async (post: BlogPostRecord & { staged?: boolean; stagedId?: string }) => {
      if (!post.staged || !post.stagedId) return;
      markLoading(post.id);
      setLastError(null);
      try {
        const response = await fetch("/api/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getCollectionHeader(activeCollectionId),
          },
          body: JSON.stringify({
            slug: post.slug,
            fieldValues: post.fieldValues,
          }),
        });
        if (response.ok) {
          const { post: newPost } = await response.json();
          await fetch(`/api/staged-items/${post.stagedId}`, { method: "DELETE" });
          setCachedPosts((current) =>
            current.filter((p) => p.id !== post.id).concat(newPost),
          );
        } else {
          setLastError("Failed to push staged item to Framer");
        }
      } catch {
        setLastError("Failed to push staged item to Framer");
      } finally {
        unmarkLoading(post.id);
      }
    },
    [activeCollectionId, markLoading, setCachedPosts, unmarkLoading],
  );

  // ── Toggle draft (with optimistic update) ──
  const toggleDraft = useCallback(
    async (post: BlogPostRecord) => {
      markLoading(post.id);
      setLastError(null);

      // Optimistic: flip the draft flag immediately
      const previousDraft = post.draft;
      setCachedPosts((current) =>
        current.map((p) =>
          p.id === post.id ? { ...p, draft: !previousDraft } : p,
        ),
      );

      try {
        const response = await fetch(`/api/posts/${post.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getCollectionHeader(activeCollectionId),
          },
          body: JSON.stringify({
            slug: post.slug,
            draft: !previousDraft,
            fieldValues: post.fieldValues,
          }),
        });
        if (response.ok) {
          const { post: nextPost } = await response.json();
          setCachedPosts((current) => upsertPost(current, nextPost));
        } else {
          // Revert optimistic update
          setCachedPosts((current) =>
            current.map((p) =>
              p.id === post.id ? { ...p, draft: previousDraft } : p,
            ),
          );
          setLastError("Failed to toggle draft status");
        }
      } catch {
        // Revert optimistic update
        setCachedPosts((current) =>
          current.map((p) =>
            p.id === post.id ? { ...p, draft: previousDraft } : p,
          ),
        );
        setLastError("Failed to toggle draft status");
      } finally {
        unmarkLoading(post.id);
      }
    },
    [activeCollectionId, markLoading, setCachedPosts, unmarkLoading],
  );

  // ── Publish (draft → live, with optimistic update) ──
  const publishPost = useCallback(
    async (post: BlogPostRecord) => {
      markLoading(post.id);
      setLastError(null);

      // Optimistic: mark as published immediately
      setCachedPosts((current) =>
        current.map((p) =>
          p.id === post.id ? { ...p, draft: false } : p,
        ),
      );

      try {
        const response = await fetch(`/api/posts/${post.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getCollectionHeader(activeCollectionId),
          },
          body: JSON.stringify({
            slug: post.slug,
            draft: false,
            fieldValues: post.fieldValues,
          }),
        });
        if (response.ok) {
          const { post: nextPost } = await response.json();
          setCachedPosts((current) => upsertPost(current, nextPost));
        } else {
          // Revert
          setCachedPosts((current) =>
            current.map((p) =>
              p.id === post.id ? { ...p, draft: true } : p,
            ),
          );
          setLastError("Failed to publish post");
        }
      } catch {
        setCachedPosts((current) =>
          current.map((p) =>
            p.id === post.id ? { ...p, draft: true } : p,
          ),
        );
        setLastError("Failed to publish post");
      } finally {
        unmarkLoading(post.id);
      }
    },
    [activeCollectionId, markLoading, setCachedPosts, unmarkLoading],
  );

  // ── Discard staged item ──
  const discardStagedItem = useCallback(
    async (postId: string, stagedId: string) => {
      markLoading(postId);
      setLastError(null);

      // Optimistic: remove from list immediately
      let removed: BlogPostRecord | undefined;
      setCachedPosts((current) => {
        removed = current.find((p) => p.id === postId);
        return current.filter((p) => p.id !== postId);
      });

      try {
        await fetch(`/api/staged-items/${stagedId}`, { method: "DELETE" });
      } catch {
        // Revert: add back
        if (removed) {
          const item = removed;
          setCachedPosts((current) => [...current, item]);
        }
        setLastError("Failed to discard staged item");
      } finally {
        unmarkLoading(postId);
      }
    },
    [markLoading, setCachedPosts, unmarkLoading],
  );

  // ── Delete post (with optimistic update + undo window) ──
  const deletePost = useCallback(
    (postId: string) => {
      setLastError(null);

      // Cancel any previous undo timer
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

      // Optimistic: remove from list immediately
      let removed: BlogPostRecord | undefined;
      setCachedPosts((current) => {
        removed = current.find((p) => p.id === postId);
        return current.filter((p) => p.id !== postId);
      });

      const revert = () => {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
        setUndoPending(null);
        if (removed) {
          const item = removed;
          setCachedPosts((current) => [...current, item]);
        }
      };

      setUndoPending({
        id: postId,
        label: `Deleted "${removed?.title || postId}"`,
        undo: revert,
        expiresAt: Date.now() + UNDO_WINDOW_MS,
      });

      // After undo window, execute the actual delete
      undoTimerRef.current = setTimeout(async () => {
        undoTimerRef.current = null;
        setUndoPending(null);
        markLoading(postId);
        try {
          const response = await fetch(`/api/posts/${postId}`, {
            method: "DELETE",
            headers: getCollectionHeader(activeCollectionId),
          });
          if (!response.ok) {
            revert();
            setLastError("Failed to delete post");
          }
        } catch {
          revert();
          setLastError("Failed to delete post");
        } finally {
          unmarkLoading(postId);
        }
      }, UNDO_WINDOW_MS);
    },
    [activeCollectionId, markLoading, setCachedPosts, unmarkLoading],
  );

  const clearError = useCallback(() => setLastError(null), []);

  return {
    loadingPosts,
    setLoadingPosts,
    lastError,
    clearError,
    undoPending,
    pushStagedItem,
    toggleDraft,
    publishPost,
    discardStagedItem,
    deletePost,
  };
}
