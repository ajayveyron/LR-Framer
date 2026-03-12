"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { BlogTable } from "@/components/blog-table";
import { ColumnControls } from "@/components/column-controls";
import { PostEditor } from "@/components/post-editor";
import type { BlogCollectionMetadata, BlogPostRecord } from "@/lib/cms-types";

const PAGE_SIZE = 20;
const COLUMN_STORAGE_KEY = "lr:dashboard:columns";
const COLUMN_STORAGE_EVENT = "lr:dashboard:columns:changed";

function PlusIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <rect
        fill="currentColor"
        fillOpacity="0.18"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.2"
        width="13"
        x="1.5"
        y="1.5"
      />
      <path d="M8 4.75V11.25" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
      <path d="M4.75 8H11.25" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 10.5L14 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

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
          .map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)))
          .join(" "),
      );
    }
  }

  return searchValues
    .filter((value): value is string => typeof value === "string" && value.length > 0)
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
  initialColumns,
  metadata,
  posts,
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
  initialColumns: string[];
  metadata: BlogCollectionMetadata;
  posts: BlogPostRecord[];
}) {
  const columnOptions = buildColumnOptions(metadata);
  const allowedColumnKeys = columnOptions.map((column) => column.key);
  const fallbackColumnsRaw = JSON.stringify(initialColumns);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [searchIndex, setSearchIndex] = useState(() => buildSearchIndex(posts, metadata));
  const deferredQuery = useDeferredValue(query);
  const pathname = usePathname();
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
    setSearchIndex(buildSearchIndex(posts, metadata));
  }, [metadata, posts]);

  const filteredPosts = deferredQuery.trim()
    ? searchIndex
      .filter((entry) => matchesSearch(entry.searchText, deferredQuery))
      .map((entry) => entry.post)
    : posts;
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, Math.max(1, page));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visiblePosts = filteredPosts.slice(startIndex, startIndex + PAGE_SIZE);
  const activeColumns = columnOptions.filter((column) =>
    selectedColumns.includes(column.key),
  );
  const draftCount = filteredPosts.filter((post) => post.draft).length;
  const isDrawerRoute = pathname?.startsWith("/posts/") ?? false;
  const activePostId = pathname?.startsWith("/posts/") && pathname !== "/posts/new"
    ? pathname.slice("/posts/".length)
    : null;
  const activePost = activePostId
    ? posts.find((post) => post.id === activePostId) ?? null
    : null;
  const isCreateRoute = pathname === "/posts/new";

  return (
    <section className="workspace-shell">
      <div className="workspace-pane workspace-pane-collection">
        <div className="workspace-pane-chrome">
          <div className="workspace-actions">
            <Link className="workspace-action workspace-action-primary" href="/posts/new">
              <span className="workspace-action-icon" aria-hidden="true">
                <PlusIcon />
              </span>
              <span>New Item</span>
            </Link>
            <ColumnControls
              onColumnsChange={(nextColumns) => {
                writeStoredColumns(nextColumns);
                setPage(1);
              }}
              options={columnOptions}
              selectedColumns={selectedColumns}
            />
            <div
              className={`workspace-badge ${
                bridgeStatus?.configured ? "workspace-badge-ready" : "workspace-badge-manual"
              }`}
            >
              <span className="workspace-badge-dot" aria-hidden="true" />
              {bridgeStatus?.configured ? "Bridge Ready" : "Manual Mode"}
            </div>
          </div>

          <label className="workspace-search" htmlFor="dashboard-search">
            <span className="workspace-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              aria-label="Search posts"
              className="workspace-search-input"
              id="dashboard-search"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search posts"
              value={query}
            />
          </label>

          <div className="workspace-collection-meta">
            <div className="stack workspace-collection-copy">
              <span className="workspace-label">{metadata.collectionName}</span>
              <span className="muted">
                {filteredPosts.length} result{filteredPosts.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="workspace-summary">
              <span>{draftCount} drafts</span>
              <span>{filteredPosts.length - draftCount} published</span>
            </div>
          </div>
        </div>

        <section className="table-shell workspace-table-shell">
          <BlogTable
            activePostId={activePostId}
            columns={activeColumns}
            metadata={metadata}
            posts={visiblePosts}
          />
        </section>

        <div className="workspace-pagination">
          <div className="page-count muted">
            {filteredPosts.length === 0
              ? "Showing 0 of 0"
              : `Showing ${startIndex + 1}-${startIndex + visiblePosts.length} of ${filteredPosts.length}`}
          </div>

          {totalPages > 1 ? (
            <div className="pagination workspace-pagination-controls">
              <button
                className="button-secondary"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                Previous
              </button>
              <span className="muted">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="button-secondary"
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {isDrawerRoute ? (
        <div className="workspace-drawer-layer">
          <Link
            aria-label="Close editor"
            className="workspace-drawer-dismiss"
            href="/"
          />
          <section className="workspace-drawer-panel">
            {isCreateRoute ? (
              <PostEditor key="new" metadata={metadata} mode="create" post={null} />
            ) : activePost ? (
              <PostEditor
                key={activePost.id}
                metadata={metadata}
                mode="edit"
                post={activePost}
              />
            ) : (
              <div className="drawer-fallback">
                <span className="eyebrow">Unavailable</span>
                <h2>This item is not in the preloaded set.</h2>
                <p className="muted">
                  The dashboard is currently preloading only the most recent items so the
                  drawer opens instantly.
                </p>
                <Link className="button-secondary" href="/">
                  Close
                </Link>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
