"use client";
import { Fragment, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Spinner } from "@phosphor-icons/react";
import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";
import type { SiteRole } from "@/lib/product-types";
import { cn } from "@/lib/utils";

type BlogTableProps = {
  activePostId?: string | null;
  columns: Array<{ key: string; label: string }>;
  metadata: BlogCollectionMetadata;
  onOpenPost: (postId: string) => void;
  posts: BlogPostRecord[];
  role: SiteRole;
  loadingPosts?: Set<string>;
  onHideColumn?: (columnKey: string) => void;
  onReorderColumns?: (sourceIndex: number, destinationIndex: number) => void;
  onDraftToggle?: (post: BlogPostRecord) => void;
  onDelete?: (postId: string) => void;
  selectedRows?: Set<string>;
  onToggleRow?: (rowId: string) => void;
  onToggleAll?: (visibleRowIds: string[]) => void;
  onShiftClick?: (rowId: string) => void;
};

type ColumnLimits = {
  defaultWidth: number;
  maxWidth: number;
  minWidth: number;
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(date);
}

function truncateValue(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function stripHtmlPreview(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getFieldForColumn(
  metadata: BlogCollectionMetadata,
  columnKey: string,
) {
  if (!columnKey.startsWith("field:")) {
    return undefined;
  }

  const fieldId = columnKey.slice("field:".length);
  return metadata.fields.find((entry) => entry.id === fieldId);
}

function getColumnLimits(
  metadata: BlogCollectionMetadata,
  columnKey: string,
): ColumnLimits {
  if (columnKey === "title") {
    return { defaultWidth: 320, minWidth: 180, maxWidth: 640 };
  }

  if (columnKey === "slug") {
    return { defaultWidth: 220, minWidth: 140, maxWidth: 420 };
  }

  if (columnKey === "status") {
    return { defaultWidth: 130, minWidth: 110, maxWidth: 180 };
  }

  if (columnKey === "lastUpdated") {
    return { defaultWidth: 180, minWidth: 150, maxWidth: 260 };
  }

  const field = getFieldForColumn(metadata, columnKey);

  switch (field?.type) {
    case "boolean":
      return { defaultWidth: 120, minWidth: 100, maxWidth: 160 };
    case "date":
      return { defaultWidth: 180, minWidth: 150, maxWidth: 260 };
    case "number":
      return { defaultWidth: 140, minWidth: 110, maxWidth: 220 };
    case "formattedText":
      return { defaultWidth: 420, minWidth: 220, maxWidth: 760 };
    case "link":
    case "image":
    case "file":
      return { defaultWidth: 120, minWidth: 80, maxWidth: 320 };
    case "array":
      return { defaultWidth: 160, minWidth: 130, maxWidth: 240 };
    default:
      return { defaultWidth: 220, minWidth: 140, maxWidth: 420 };
  }
}

function clampWidth(value: number, limits: ColumnLimits) {
  return Math.min(limits.maxWidth, Math.max(limits.minWidth, value));
}

function formatFieldValue(
  field: DashboardFieldDefinition | undefined,
  value: DashboardFieldValue,
) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (Array.isArray(value)) {
    if (field?.type === "array") {
      return `${value.length} item${value.length === 1 ? "" : "s"}`;
    }

    return value.length > 0 ? value.join(", ") : "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (field?.type === "date") {
    return formatDate(value);
  }

  if (field?.type === "formattedText") {
    const plainText = stripHtmlPreview(value);
    return plainText ? truncateValue(plainText) : "-";
  }

  return truncateValue(value);
}

function getCellValue(
  post: BlogPostRecord,
  metadata: BlogCollectionMetadata,
  columnKey: string,
) {
  if (columnKey === "title") {
    return post.title;
  }

  if (columnKey === "slug") {
    return post.slug;
  }

  if (columnKey === "status") {
    return post.draft ? "Draft" : "Live";
  }

  if (columnKey === "lastUpdated") {
    return formatDate(post.lastUpdated);
  }

  if (!columnKey.startsWith("field:")) {
    return "-";
  }

  const fieldId = columnKey.slice("field:".length);
  const field = getFieldForColumn(metadata, columnKey);
  return formatFieldValue(field, post.fieldValues[fieldId] ?? null);
}

function renderCellContent(
  post: BlogPostRecord,
  metadata: BlogCollectionMetadata,
  columnKey: string,
) {
  if (columnKey === "title") {
    return (
      <div className="flex min-w-0 items-center gap-3 text-inherit">
        <span
          aria-hidden="true"
          className="inline-flex size-4 shrink-0 items-center justify-center"
        >
          <svg
            fill="none"
            height="16"
            viewBox="0 0 16 16"
            width="16"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 1.75H8.75L12.5 5.5V13.25C12.5 13.9404 11.9404 14.5 11.25 14.5H4.75C4.05964 14.5 3.5 13.9404 3.5 13.25V3C3.5 2.30964 4.05964 1.75 4.75 1.75H4Z"
              fill="currentColor"
              fillOpacity="0.18"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.2"
            />
            <path
              d="M8.5 1.75V5.75H12.5"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.2"
            />
          </svg>
        </span>
        <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-bottom">
          {post.title}
        </span>
      </div>
    );
  }

  if (columnKey.startsWith("field:")) {
    const field = getFieldForColumn(metadata, columnKey);
    const fieldId = columnKey.slice("field:".length);
    const value = post.fieldValues[fieldId];

    if (field?.type === "image" && typeof value === "string" && value) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={field.name}
          className="block h-8 w-[76px] max-w-none overflow-hidden rounded-lg border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] object-cover object-center"
          loading="lazy"
          src={value}
        />
      );
    }
  }

  return (
    <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-bottom">
      {getCellValue(post, metadata, columnKey)}
    </span>
  );
}

export function BlogTable({
  activePostId = null,
  columns,
  metadata,
  onOpenPost,
  posts,
  role,
  loadingPosts,
  onHideColumn,
  onReorderColumns,
  onDraftToggle,
  onDelete,
  selectedRows,
  onToggleRow,
  onToggleAll,
  onShiftClick,
}: BlogTableProps) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      columns.map((column) => [
        column.key,
        getColumnLimits(metadata, column.key).defaultWidth,
      ]),
    ),
  );
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const lastClickedIndexRef = useRef<number | null>(null);

  // Derive selection-related state
  const hasSelection = selectedRows !== undefined && onToggleRow !== undefined;
  const allPostIds = posts.map((p) => p.id);
  const allVisibleSelected = hasSelection && allPostIds.length > 0 && allPostIds.every((id) => selectedRows.has(id));
  const someVisibleSelected = hasSelection && !allVisibleSelected && allPostIds.some((id) => selectedRows.has(id));
  const headerCheckedState: boolean | "indeterminate" = allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false;

  // Build a flat ordered list of post IDs for shift-click index tracking
  const flatPostIds = posts.map((p) => p.id);

  useEffect(() => {
    return () => {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, []);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-6 py-14 text-center text-[color:var(--framer-fresco-panelDescription-color)]">
        <strong className="text-[color:var(--framer-fresco-panelTitle-color)]">
          No posts loaded yet.
        </strong>
        <p>Add your first draft post.</p>
      </div>
    );
  }

  const CHECKBOX_COL_WIDTH = 48;

  const tableMinWidth = columns.reduce(
    (sum, column) =>
      sum +
      (columnWidths[column.key] ??
        getColumnLimits(metadata, column.key).defaultWidth),
    hasSelection ? CHECKBOX_COL_WIDTH : 0,
  );

  const groupedPosts = [
    {
      key: "drafts",
      label: "Drafts",
      posts: posts.filter((post) => post.draft),
    },
    {
      key: "published",
      label: "Published",
      posts: posts.filter((post) => !post.draft),
    },
  ].filter((group) => group.posts.length > 0);

  return (
    <div className="h-full overflow-auto">
      <table
        className="w-full border-collapse table-fixed"
        style={{ minWidth: tableMinWidth }}
      >
        <colgroup>
          {hasSelection && <col style={{ width: CHECKBOX_COL_WIDTH }} />}
          {columns.map((column) => {
            const width =
              columnWidths[column.key] ??
              getColumnLimits(metadata, column.key).defaultWidth;

            return <col key={column.key} style={{ width }} />;
          })}
        </colgroup>
        <thead>
          <tr>
            {hasSelection && (
              <th
                className="sticky top-0 z-10 border-b border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] px-3 py-[18px] text-center"
              >
                <Checkbox
                  aria-label={allVisibleSelected ? "Deselect all rows" : "Select all rows"}
                  checked={headerCheckedState}
                  onCheckedChange={() => {
                    onToggleAll?.(allPostIds);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            )}
            {columns.map((column, index) => (
              <ContextMenu key={column.key}>
                <ContextMenuTrigger asChild>
                  <th
                    className={cn(
                      "sticky top-0 z-10 border-b border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] px-[22px] py-[18px] text-left text-xs font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)]",
                      column.key === "slug" && "font-mono",
                      draggedColumnIndex === index && "opacity-50",
                    )}
                    draggable
                    onDragStart={(event) => {
                      if (draggingColumn) {
                        event.preventDefault();
                        return;
                      }
                      setDraggedColumnIndex(index);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedColumnIndex !== null && draggedColumnIndex !== index) {
                        onReorderColumns?.(draggedColumnIndex, index);
                      }
                      setDraggedColumnIndex(null);
                    }}
                    onDragEnd={() => setDraggedColumnIndex(null)}
                  >
                    <div className="relative flex min-h-5 items-center pr-2">
                      <span>{column.label}</span>
                      <button
                        aria-label={`Resize ${column.label} column`}
                        className={cn(
                          "absolute top-[-14px] right-[-12px] h-[calc(100%+28px)] w-6 cursor-col-resize touch-none bg-transparent p-0 after:absolute after:top-[20%] after:bottom-[20%] after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-[var(--framer-fresco-panelDivider-color)] after:transition-colors hover:after:bg-[var(--framer-fresco-panelSubtitle-color)] focus-visible:outline-none focus-visible:after:bg-[var(--framer-fresco-panelSubtitle-color)]",
                          draggingColumn === column.key &&
                            "after:bg-[var(--framer-fresco-panelSubtitle-color)]",
                        )}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          const limits = getColumnLimits(metadata, column.key);
                          const startWidth =
                            columnWidths[column.key] ?? limits.defaultWidth;
                          const startX = event.clientX;

                          setDraggingColumn(column.key);
                          document.body.style.cursor = "col-resize";
                          document.body.style.userSelect = "none";

                          const handlePointerMove = (moveEvent: PointerEvent) => {
                            const nextWidth = clampWidth(
                              startWidth + moveEvent.clientX - startX,
                              limits,
                            );

                            setColumnWidths((current) => ({
                              ...current,
                              [column.key]: nextWidth,
                            }));
                          };

                          const stopDragging = () => {
                            setDraggingColumn(null);
                            document.body.style.removeProperty("cursor");
                            document.body.style.removeProperty("user-select");
                            window.removeEventListener(
                              "pointermove",
                              handlePointerMove,
                            );
                            window.removeEventListener("pointerup", stopDragging);
                            window.removeEventListener(
                              "pointercancel",
                              stopDragging,
                            );
                          };

                          window.addEventListener("pointermove", handlePointerMove);
                          window.addEventListener("pointerup", stopDragging);
                          window.addEventListener("pointercancel", stopDragging);
                        }}
                        type="button"
                      />
                    </div>
                  </th>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => onHideColumn?.(column.key)}>
                    Hide Column
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupedPosts.map((group) => (
            <Fragment key={group.key}>
              <tr
                className="bg-[var(--framer-app-surface-subtle-color)]"
                key={`${group.key}-label`}
              >
                <td
                  className="border-b border-[var(--framer-fresco-panelDivider-color)] px-[22px] py-4 text-[13px] font-bold text-[color:var(--framer-fresco-panelTitle-color)]"
                  colSpan={columns.length + (hasSelection ? 1 : 0)}
                >
                  {group.label}
                </td>
              </tr>
              {group.posts.map((post) => (
                <ContextMenu key={post.id}>
                  <ContextMenuTrigger asChild>
                    <tr
                      aria-label={`Edit ${post.title}`}
                      className={cn(
                        "group cursor-pointer transition-all hover:bg-[var(--framer-app-surface-subtle-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--framer-fresco-tintDimmed-color)] focus-visible:ring-inset data-[active=true]:bg-[var(--framer-app-surface-muted-color)]",
                        loadingPosts?.has(post.id) && "pointer-events-none opacity-50 duration-300",
                        hasSelection && selectedRows.has(post.id) && "bg-[var(--framer-fresco-tintDimmed-color)]",
                      )}
                      data-active={post.id === activePostId}
                      onClick={() => {
                        onOpenPost(post.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }

                        event.preventDefault();
                        onOpenPost(post.id);
                      }}
                      role="link"
                      tabIndex={0}
                    >
                      {hasSelection && (
                        <td
                          className="border-b border-[var(--framer-fresco-panelDivider-color)] px-3 py-[18px] text-center"
                        >
                          <Checkbox
                            aria-label={`Select ${post.title}`}
                            checked={selectedRows.has(post.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              const postIndex = flatPostIds.indexOf(post.id);
                              if (e.shiftKey && lastClickedIndexRef.current !== null) {
                                onShiftClick?.(post.id);
                              } else {
                                onToggleRow(post.id);
                              }
                              lastClickedIndexRef.current = postIndex;
                            }}
                            onCheckedChange={() => {
                              // Handled by onClick for shift-key detection
                            }}
                          />
                        </td>
                      )}
                      {columns.map((column) => {
                        if (column.key === "status") {
                          const isLoading = loadingPosts?.has(post.id);
                          return (
                            <td
                              className="border-b border-[var(--framer-fresco-panelDivider-color)] px-[22px] py-[18px] text-[color:var(--framer-fresco-panelSubtitle-color)] transition-colors group-hover:text-[color:var(--framer-fresco-panelTitle-color)] group-data-[active=true]:text-[color:var(--framer-fresco-panelTitle-color)]"
                              key={column.key}
                            >
                              <Badge
                                className={cn(
                                  "h-[26px] px-2.5 text-xs font-semibold data-[loading=true]:bg-transparent data-[loading=true]:opacity-80 transition-opacity",
                                  post.draft
                                    ? "framer-status-pill framer-status-pill-draft"
                                    : "framer-status-pill framer-status-pill-live",
                                )}
                                data-loading={isLoading}
                                variant="outline"
                              >
                                {isLoading && <Spinner className="mr-1.5 size-3.5 animate-spin" />}
                                {post.draft ? "Draft" : "Live"}
                              </Badge>
                            </td>
                          );
                        }

                        return (
                            <td
                              className={cn(
                                "border-b border-[var(--framer-fresco-panelDivider-color)] px-[22px] py-[18px] text-[color:var(--framer-fresco-panelSubtitle-color)] transition-colors group-hover:text-[color:var(--framer-fresco-panelTitle-color)] group-data-[active=true]:text-[color:var(--framer-fresco-panelTitle-color)]",
                                column.key === "slug" && "font-mono",
                              )}
                            key={column.key}
                            title={String(getCellValue(post, metadata, column.key))}
                          >
                            {renderCellContent(post, metadata, column.key)}
                          </td>
                        );
                      })}
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onSelect={() => {
                        onDraftToggle?.(post);
                      }}
                    >
                      {post.draft ? "Publish" : "Move to Drafts"}
                    </ContextMenuItem>
                    {role === "admin" && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => {
                            if (window.confirm("Are you sure you want to delete this post?")) {
                              onDelete?.(post.id);
                            }
                          }}
                        >
                          Delete
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
