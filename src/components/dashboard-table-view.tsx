"use client";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { AIChatPanel } from "@/components/ai-chat-panel";
import { BlogTable } from "@/components/blog-table";
import { ColumnControls } from "@/components/column-controls";
import { DashboardAccountLink } from "@/components/dashboard-account-link";
import { PostEditor } from "@/components/post-editor";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { Sparkle, PlusIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BlogCollectionMetadata, BlogPostRecord } from "@/lib/cms-types";
import type { SiteRole } from "@/lib/product-types";
import { toggleRow, toggleAllRows, shiftClickRange } from "@/lib/selection";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const COLUMN_STORAGE_KEY = "lr:dashboard:columns";
const COLUMN_STORAGE_EVENT = "lr:dashboard:columns:changed";

type DrawerState =
  | { mode: "create" }
  | { mode: "edit"; postId: string };





function buildColumnOptions(metadata: BlogCollectionMetadata) {
  const titleFieldId = metadata.logicalFields.title;

  return [
    { key: "title", label: "Title" },
    { key: "slug", label: "Slug" },
    { key: "status", label: "Status" },
    { key: "lastUpdated", label: "Last updated" },
    ...metadata.fields
      .filter((field) => field.id !== titleFieldId)
      .map((field) => ({
        key: `field:${field.id}`,
        label: field.name,
      })),
  ];
}

function includesQuery(value: string | null | undefined, query: string) {
  if (!value) {
    return false;
  }

  return value.toLowerCase().includes(query);
}

function buildSearchText(
  post: BlogPostRecord,
  metadata: BlogCollectionMetadata,
) {
  const searchValues = [
    post.title,
    post.slug,
    post.lastUpdated,
    post.lastUpdatedBy,
  ];

  for (const field of metadata.fields) {
    const value = post.fieldValues[field.id];

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      searchValues.push(String(value));
      continue;
    }

    if (Array.isArray(value)) {
      searchValues.push(
        value
          .map((entry) =>
            typeof entry === "string" ? entry : JSON.stringify(entry),
          )
          .join(" "),
      );
    }
  }

  return searchValues
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    )
    .join("\n")
    .toLowerCase();
}

function buildSearchIndex(
  posts: BlogPostRecord[],
  metadata: BlogCollectionMetadata,
) {
  return posts.map((post) => ({
    post,
    searchText: buildSearchText(post, metadata),
  }));
}

function sortPostsByRecency(posts: BlogPostRecord[]) {
  return [...posts].sort((left, right) => {
    if (left.draft !== right.draft) {
      return left.draft ? -1 : 1;
    }

    const leftDate = Date.parse(left.date ?? left.lastUpdated ?? "") || 0;
    const rightDate = Date.parse(right.date ?? right.lastUpdated ?? "") || 0;
    return rightDate - leftDate;
  });
}

function upsertCachedPost(posts: BlogPostRecord[], nextPost: BlogPostRecord) {
  const remaining = posts.filter((post) => post.id !== nextPost.id);
  return sortPostsByRecency([...remaining, nextPost]);
}

function getDrawerPath(drawerState: DrawerState | null) {
  if (!drawerState) {
    return "/dashboard";
  }

  if (drawerState.mode === "create") {
    return "/dashboard/posts/new";
  }

  return `/dashboard/posts/${drawerState.postId}`;
}

function parseDrawerState(pathname: string): DrawerState | null {
  if (pathname === "/dashboard/posts/new") {
    return { mode: "create" };
  }

  if (pathname.startsWith("/dashboard/posts/")) {
    return {
      mode: "edit",
      postId: pathname.slice("/dashboard/posts/".length),
    };
  }

  return null;
}

function matchesSearch(searchText: string, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return includesQuery(searchText, query);
}

function readStoredColumnsRaw(fallbackColumnsRaw: string) {
  if (typeof window === "undefined") {
    return fallbackColumnsRaw;
  }

  return window.localStorage.getItem(COLUMN_STORAGE_KEY) ?? fallbackColumnsRaw;
}

function parseSelectedColumns(
  rawValue: string,
  allowedColumnKeys: string[],
  fallbackColumns: string[],
) {
  try {
    const allowedColumns = new Set(allowedColumnKeys);
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return fallbackColumns;
    }

    const nextColumns = parsed.filter(
      (value): value is string =>
        typeof value === "string" && allowedColumns.has(value),
    );

    return nextColumns.length > 0 ? nextColumns : fallbackColumns;
  } catch {
    return fallbackColumns;
  }
}

function writeStoredColumns(columns: string[]) {
  window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columns));
  window.dispatchEvent(new Event(COLUMN_STORAGE_EVENT));
}

export function DashboardTableView({
  bridgeStatus,
  initialDrawerState = null,
  initialColumns,
  metadata,
  posts,
  role,
}: {
  bridgeStatus?: {
    configured: boolean;
    issues: Array<{ path: string; message: string }>;
    webhookPath: string;
    manualSyncPath: string;
    dataSourceId: string | null;
    statusPropertyName: string;
    approvedStatusValue: string;
    slugPropertyName: string;
    framerItemIdPropertyName: string;
    fieldMap: Record<string, string>;
  };
  initialDrawerState?: DrawerState | null;
  initialColumns: string[];
  metadata: BlogCollectionMetadata;
  posts: BlogPostRecord[];
  role: SiteRole;
}) {
  const columnOptions = buildColumnOptions(metadata);
  const allowedColumnKeys = columnOptions.map((column) => column.key);
  const fallbackColumnsRaw = JSON.stringify(initialColumns);
  const [cachedPosts, setCachedPosts] = useState(() => sortPostsByRecency(posts));
  const [drawerState, setDrawerState] = useState<DrawerState | null>(
    initialDrawerState,
  );
  const [loadingPosts, setLoadingPosts] = useState<Set<string>>(new Set());
  const [editorRevision, setEditorRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const lastClickedIndexRef = useRef<number | null>(null);
  const [searchIndex, setSearchIndex] = useState(() =>
    buildSearchIndex(posts, metadata),
  );
  const deferredQuery = useDeferredValue(query);
  const selectedColumnsRaw = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      window.addEventListener(COLUMN_STORAGE_EVENT, callback);

      return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(COLUMN_STORAGE_EVENT, callback);
      };
    },
    () => readStoredColumnsRaw(fallbackColumnsRaw),
    () => fallbackColumnsRaw,
  );
  const selectedColumns = parseSelectedColumns(
    selectedColumnsRaw,
    allowedColumnKeys,
    initialColumns,
  );

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setCachedPosts(sortPostsByRecency(posts));
  }, [posts]);

  useEffect(() => {
    setSearchIndex(buildSearchIndex(cachedPosts, metadata));
  }, [cachedPosts, metadata]);

  useEffect(() => {
    const handlePopState = () => {
      setDrawerState(parseDrawerState(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();

      // Cmd+K → toggle AI chat panel
      if (key === "k") {
        event.preventDefault();
        setChatOpen((prev) => !prev);
        return;
      }

      // Cmd+\ → focus search
      if (key === "\\") {
        const target = event.target as HTMLElement | null;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target?.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, []);

  // Emit wide event when selection changes
  useEffect(() => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        event: "dashboard.rows.selected",
        count: selectedRows.size,
      }),
    );
  }, [selectedRows]);

  function commitDrawerState(
    nextDrawerState: DrawerState | null,
    historyMode: "push" | "replace" = "push",
  ) {
    setDrawerState(nextDrawerState);

    if (typeof window === "undefined") {
      return;
    }

    const nextPath = getDrawerPath(nextDrawerState);
    if (window.location.pathname === nextPath) {
      return;
    }

    window.history[historyMode === "replace" ? "replaceState" : "pushState"](
      null,
      "",
      nextPath,
    );
  }

  function handleOpenCreate() {
    commitDrawerState({ mode: "create" });
  }

  function handleOpenPost(postId: string) {
    commitDrawerState({ mode: "edit", postId });
  }

  function handleCloseDrawer() {
    commitDrawerState(null, "replace");
  }

  function handlePostSaved(
    nextPost: BlogPostRecord,
    saveMode: "create" | "edit",
  ) {
    setCachedPosts((current) => upsertCachedPost(current, nextPost));
    setEditorRevision((current) => current + 1);
    commitDrawerState(
      { mode: "edit", postId: nextPost.id },
      saveMode === "create" ? "replace" : "replace",
    );
  }

  const filteredPosts = deferredQuery.trim()
    ? searchIndex
        .filter((entry) => matchesSearch(entry.searchText, deferredQuery))
        .map((entry) => entry.post)
    : cachedPosts;
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, Math.max(1, page));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visiblePosts = filteredPosts.slice(startIndex, startIndex + PAGE_SIZE);
  const visiblePostIds = visiblePosts.map((post) => post.id);

  function handleToggleRow(rowId: string) {
    setSelectedRows((current) => toggleRow(current, rowId));
    const idx = visiblePostIds.indexOf(rowId);
    if (idx !== -1) {
      lastClickedIndexRef.current = idx;
    }
  }

  function handleToggleAll(visibleRowIds: string[]) {
    setSelectedRows((current) => toggleAllRows(current, visibleRowIds));
    lastClickedIndexRef.current = null;
  }

  function handleShiftClick(rowId: string) {
    const clickedIndex = visiblePostIds.indexOf(rowId);
    if (clickedIndex === -1) return;
    const lastIndex = lastClickedIndexRef.current ?? clickedIndex;
    setSelectedRows((current) =>
      shiftClickRange(current, visiblePostIds, lastIndex, clickedIndex),
    );
    lastClickedIndexRef.current = clickedIndex;
  }

  function handleClearSelection() {
    setSelectedRows(new Set());
    lastClickedIndexRef.current = null;
  }

  const selectedPosts = useMemo(
    () => cachedPosts.filter((p) => selectedRows.has(p.id)),
    [cachedPosts, selectedRows],
  );

  const handlePostsUpdated = useCallback(
    (updatedPosts: BlogPostRecord[]) => {
      setCachedPosts((current) => {
        const updated = new Map(updatedPosts.map((p) => [p.id, p]));
        return current.map((p) => updated.get(p.id) ?? p);
      });
    },
    [],
  );

  const activeColumns = selectedColumns
    .map((key) => columnOptions.find((column) => column.key === key))
    .filter((column): column is { key: string; label: string } => column !== undefined);
  const draftCount = filteredPosts.filter((post) => post.draft).length;
  const isDrawerRoute = drawerState !== null;
  const activePostId =
    drawerState?.mode === "edit" ? drawerState.postId : null;
  const activePost = activePostId
    ? (cachedPosts.find((post) => post.id === activePostId) ?? null)
    : null;
  const isCreateRoute = drawerState?.mode === "create";
  const pageOptions = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <section className="relative md:min-h-[calc(100vh-16px)]">
      <div className="flex min-h-screen flex-col overflow-hidden bg-[var(--framer-fresco-panelBackground-color)] shadow-[inset_0_1px_0_var(--framer-app-frame-overlay-color)] md:min-h-[calc(100vh-16px)] md:border md:border-[var(--framer-fresco-panelDivider-color)]">
        <div className="border-b border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)]">
          <div className="flex flex-wrap items-start gap-2.5 border-b border-[var(--framer-fresco-panelDivider-color)] p-4 md:items-center">
            <Button
              className="h-11 gap-2.5 px-4 text-sm font-semibold"
              onClick={handleOpenCreate}
              size="sm"
              type="button"
            >
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center"
              >
                <PlusIcon weight="bold" />
              </span>
              <span>New Item</span>
            </Button>
            <div className="ml-auto flex w-full flex-wrap items-center justify-between gap-2.5 md:w-auto md:justify-end">
              {bridgeStatus ? (
                <Badge
                  className="flex h-11 items-center gap-2.5 rounded-full border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-4 text-[13px] font-semibold text-[color:var(--framer-fresco-panelDescription-color)]"
                  variant="outline"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-2 rounded-full",
                      bridgeStatus.configured
                        ? "framer-live-dot"
                        : "bg-[var(--framer-fresco-panelSubtitle-color)]",
                    )}
                  />
                  {bridgeStatus.configured ? "Bridge Ready" : "Manual Mode"}
                </Badge>
              ) : null}
              <Button
                aria-label="Open AI chat"
                className="size-11 rounded-full p-0"
                onClick={() => setChatOpen(true)}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <Sparkle className="size-5" weight="duotone" />
              </Button>
              <DashboardAccountLink />
            </div>
          </div>

          <label
            className="flex h-auto items-center gap-3 border-b border-[var(--framer-fresco-panelDivider-color)] px-5 py-2 text-[color:var(--framer-fresco-panelSubtitle-color)]"
            htmlFor="dashboard-search"
          >
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center"
            >
              <MagnifyingGlassIcon />
            </span>
            <Input
              aria-label="Search items"
              className="h-full border-0 bg-transparent px-4 py-4 text-lg text-[color:var(--framer-fresco-settingsText-color)] shadow-none placeholder:text-[color:var(--framer-fresco-panelSubtitle-color)] focus-visible:border-0 focus-visible:ring-0"
              id="dashboard-search"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search items"
              ref={searchInputRef}
              value={query}
            />
            <KbdGroup className="ml-auto hidden sm:inline-flex">
              <Kbd className="text-[color:var(--framer-fresco-panelSubtitle-color)]">
                {typeof navigator !== "undefined" &&
                /mac/i.test(navigator.platform)
                  ? "⌘"
                  : "Ctrl"}
              </Kbd>
              <Kbd className="text-[color:var(--framer-fresco-panelSubtitle-color)]">
                \
              </Kbd>
            </KbdGroup>
          </label>

          <div className="flex flex-col gap-4 border-b border-[var(--framer-fresco-panelDivider-color)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
                {metadata.collectionName}
              </span>
              <span className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                {filteredPosts.length} result
                {filteredPosts.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {selectedRows.size > 0 && (
                <SelectionToolbar
                  selectedCount={selectedRows.size}
                  onClearSelection={handleClearSelection}
                />
              )}
              <div className="inline-flex flex-wrap items-center gap-4 text-[13px] text-[color:var(--framer-fresco-panelDescription-color)]">
                <span>{draftCount} drafts</span>
                <span>{filteredPosts.length - draftCount} published</span>
              </div>
              <ColumnControls
                onColumnsChange={(nextColumns) => {
                  writeStoredColumns(nextColumns);
                  setPage(1);
                }}
                options={columnOptions}
                selectedColumns={selectedColumns}
              />
            </div>
          </div>
        </div>

        <section className="min-h-0 flex-1">
          <BlogTable
            activePostId={activePostId}
            columns={activeColumns}
            metadata={metadata}
            onOpenPost={handleOpenPost}
            posts={visiblePosts}
            role={role}
            loadingPosts={loadingPosts}
            selectedRows={selectedRows}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
            onShiftClick={handleShiftClick}
            onHideColumn={(columnKey) => {
              const nextSelected = selectedColumns.filter((key) => key !== columnKey);
              if (nextSelected.length > 0) {
                writeStoredColumns(nextSelected);
              }
            }}
            onReorderColumns={(sourceIndex, destinationIndex) => {
              const nextColumns = [...selectedColumns];
              const [reorderedItem] = nextColumns.splice(sourceIndex, 1);
              nextColumns.splice(destinationIndex, 0, reorderedItem);
              writeStoredColumns(nextColumns);
            }}
            onDraftToggle={async (post) => {
              setLoadingPosts((prev) => new Set(prev).add(post.id));
              try {
                const response = await fetch(`/api/posts/${post.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    slug: post.slug,
                    draft: !post.draft,
                    fieldValues: post.fieldValues,
                  }),
                });
                if (response.ok) {
                  const { post: nextPost } = await response.json();
                  setCachedPosts((current) => upsertCachedPost(current, nextPost));
                }
              } catch (error) {
                console.error("Failed to toggle draft status", error);
              } finally {
                setLoadingPosts((prev) => {
                  const next = new Set(prev);
                  next.delete(post.id);
                  return next;
                });
              }
            }}
            onDelete={async (postId) => {
              setLoadingPosts((prev) => new Set(prev).add(postId));
              try {
                const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
                if (response.ok) {
                  setCachedPosts((current) => current.filter((post) => post.id !== postId));
                }
              } catch (error) {
                console.error("Failed to delete post", error);
              } finally {
                setLoadingPosts((prev) => {
                  const next = new Set(prev);
                  next.delete(postId);
                  return next;
                });
              }
            }}
          />
        </section>

        <div className="flex flex-col gap-4 border-t border-[var(--framer-fresco-panelDivider-color)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
            {filteredPosts.length === 0
              ? "Showing 0 of 0"
              : `Showing ${startIndex + 1}-${startIndex + visiblePosts.length} of ${filteredPosts.length}`}
          </div>

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
              <Button
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                Previous
              </Button>
              <Select
                onValueChange={(value) => {
                  setPage(Number(value));
                }}
                value={String(currentPage)}
              >
                <SelectTrigger
                  aria-label="Select page"
                  className="min-w-32 text-[color:var(--framer-fresco-settingsText-color)]"
                  size="sm"
                >
                  <SelectValue placeholder={`Page ${currentPage}`} />
                </SelectTrigger>
                <SelectContent>
                  {pageOptions.map((pageNumber) => (
                    <SelectItem key={pageNumber} value={String(pageNumber)}>
                      Page {pageNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                of {totalPages}
              </span>
              <Button
                disabled={currentPage === totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                size="sm"
                type="button"
                variant="outline"
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Sheet
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDrawer();
          }
        }}
        open={isDrawerRoute}
      >
        <SheetContent
          className="gap-0 overflow-hidden border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] p-0 text-[color:var(--framer-fresco-panelTitle-color)] shadow-[-40px_0_120px_rgba(0,0,0,0.55)] data-[side=right]:w-full data-[side=right]:sm:max-w-none md:data-[side=right]:top-2 md:data-[side=right]:right-2 md:data-[side=right]:bottom-2 md:data-[side=right]:w-[min(72vw,920px)] xl:data-[side=right]:w-[min(56vw,980px)]"
          showCloseButton={false}
          side="right"
        >
          <SheetTitle className="sr-only">
            {isCreateRoute
              ? "Create post"
              : activePost
                ? `Edit ${activePost.title}`
                : "Post editor"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review and edit the selected CMS entry in a side drawer.
          </SheetDescription>
          <div className="flex min-h-0 flex-1 [&>*]:min-w-0 [&>*]:flex-1">
            {isCreateRoute ? (
              <PostEditor
                key={`new:${editorRevision}`}
                metadata={metadata}
                mode="create"
                onClose={handleCloseDrawer}
                onPostSaved={handlePostSaved}
                post={null}
              />
            ) : activePost ? (
              <PostEditor
                key={`${activePost.id}:${editorRevision}`}
                metadata={metadata}
                mode="edit"
                onClose={handleCloseDrawer}
                onPostSaved={handlePostSaved}
                post={activePost}
              />
            ) : (
              <div className="flex h-full flex-col gap-3.5 p-7">
                <span className="framer-kicker w-fit">Unavailable</span>
                <h2 className="font-heading text-3xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]">
                  This item is not in the preloaded set.
                </h2>
                <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
                  The drawer keeps item data in memory, but this entry is not
                  available in the current client cache.
                </p>
                <Button
                  onClick={handleCloseDrawer}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AIChatPanel
        metadata={metadata}
        onOpenChange={setChatOpen}
        onPostsUpdated={handlePostsUpdated}
        onClearSelection={handleClearSelection}
        open={chatOpen}
        selectedPosts={selectedPosts}
      />
    </section>
  );
}
