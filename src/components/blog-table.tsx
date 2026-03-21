"use client";
import {
  Fragment,
  useRef,
  type MutableRefObject,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Spinner, Sparkle, ChatCircle } from "@phosphor-icons/react";
import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";
import type { ContentNudge } from "@/lib/content-nudges";
import type { SiteRole } from "@/lib/product-types";

import { cn } from "@/lib/utils";

type BlogTableProps = {
  activePostId?: string | null;
  actionsDisabled?: boolean;
  columns: Array<{ key: string; label: string }>;
  metadata: BlogCollectionMetadata;
  nudges?: Map<string, ContentNudge>;
  onNudgeClick?: (postId: string, prompt: string) => void;
  onOpenPost: (postId: string) => void;
  posts: BlogPostRecord[];
  role: SiteRole;
  loadingPosts?: Set<string>;
  onDraftToggle?: (post: BlogPostRecord) => void;
  onDelete?: (postId: string) => void;
  selectedRows?: Set<string>;
  onToggleRow?: (rowId: string) => void;
  onToggleAll?: (visibleRowIds: string[]) => void;
  onShiftClick?: (rowId: string) => void;
  onChatWithItem?: (postId: string) => void;
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

function formatFieldValue(
  field: DashboardFieldDefinition | undefined,
  value: DashboardFieldValue,
) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  // Image field value with alt text metadata
  if (typeof value === "object" && !Array.isArray(value) && "url" in value) {
    return truncateValue(value.url);
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
  if (columnKey.startsWith("field:")) {
    const field = getFieldForColumn(metadata, columnKey);
    const fieldId = columnKey.slice("field:".length);
    const value = post.fieldValues[fieldId];

    if (field?.type === "image" && typeof value === "string" && value) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={field.name}
          className="block h-8 w-[76px] max-w-none overflow-hidden rounded-lg border border-fresco-divider bg-fresco-surface-muted object-cover object-center"
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

function FileIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
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
  );
}

function toggleRowSelection(
  event: Pick<MouseEvent, "shiftKey"> | Pick<React.MouseEvent, "shiftKey">,
  postId: string,
  flatPostIds: string[],
  lastClickedIndexRef: MutableRefObject<number | null>,
  onToggleRow?: (rowId: string) => void,
  onShiftClick?: (rowId: string) => void,
) {
  const postIndex = flatPostIds.indexOf(postId);

  if (event.shiftKey && lastClickedIndexRef.current !== null) {
    onShiftClick?.(postId);
  } else {
    onToggleRow?.(postId);
  }

  lastClickedIndexRef.current = postIndex;
}

export function BlogTable({
  activePostId = null,
  actionsDisabled = false,
  columns,
  metadata,
  nudges,
  onNudgeClick,
  onOpenPost,
  posts,
  role,
  loadingPosts,
  onDraftToggle,
  onDelete,
  selectedRows,
  onToggleRow,
  onToggleAll,
  onShiftClick,
  onChatWithItem,
}: BlogTableProps) {
  const lastClickedIndexRef = useRef<number | null>(null);

  // Derive selection-related state
  const hasSelection = selectedRows !== undefined && onToggleRow !== undefined;
  const isSelectionMode = hasSelection && selectedRows.size > 0;
  const allPostIds = posts.map((p) => p.id);
  const allVisibleSelected = hasSelection && allPostIds.length > 0 && allPostIds.every((id) => selectedRows.has(id));
  const someVisibleSelected = hasSelection && !allVisibleSelected && allPostIds.some((id) => selectedRows.has(id));
  const headerCheckedState: boolean | "indeterminate" = allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false;

  // Build a flat ordered list of post IDs for shift-click index tracking
  const flatPostIds = posts.map((p) => p.id);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-6 py-14 text-center text-fresco-description">
        <strong className="text-fresco-title">
          Nothing to see here.
        </strong>
        {/* <p>Add your first draft post.</p> */}
      </div>
    );
  }

  const tableMinWidth = columns.reduce(
    (sum, column) =>
      sum +
      getColumnLimits(metadata, column.key).defaultWidth,
    0,
  );

  const drafts = posts.filter((post) => post.draft);
  const published = posts.filter((post) => !post.draft);
  const hasBothGroups = drafts.length > 0 && published.length > 0;

  const groupedPosts = [
    { key: "drafts", label: "Drafts", posts: drafts },
    { key: "published", label: "Published", posts: published },
  ].filter((group) => group.posts.length > 0);

  return (
    <div className="h-full max-w-full min-w-0 overflow-x-auto">
      <table
        className="min-w-full border-separate border-spacing-0 table-fixed"
        style={{ width: tableMinWidth }}
      >
        <colgroup>
          {columns.map((column) => {
            const width = getColumnLimits(metadata, column.key).defaultWidth;

            return <col key={column.key} style={{ width }} />;
          })}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={cn(
                  "text-[#888] text-sm font-normal", "relative z-10 border-b border-dash-content-border px-[22px] py-3 text-left transition-colors",
                )}
                key={column.key}
              >
                <div className="relative flex min-h-5 items-center pr-2">
                  {column.key === "title" && hasSelection && (
                    <span className="mr-3 inline-flex size-4 shrink-0 items-center justify-center">
                      {isSelectionMode ? (
                        <Checkbox
                          aria-label={allVisibleSelected ? "Deselect all rows" : "Select all rows"}
                          checked={headerCheckedState}
                          onCheckedChange={() => {
                            onToggleAll?.(allPostIds);
                          }}
                          onClick={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <FileIcon className="size-4 opacity-0" />
                      )}
                    </span>
                  )}
                  <span>{column.label}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <motion.tbody
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.05,
              },
            },
          }}
        >
          {groupedPosts.map((group) => (
            <Fragment key={group.key}>
              {hasBothGroups && (
                <tr
                  className="bg-dash-group-bg"
                >
                  <td
                    className={cn("text-xs font-normal", "border-b border-dash-content-border px-[22px] py-3")}
                    colSpan={columns.length}
                  >
                    {group.label}
                  </td>
                </tr>
              )}
              <AnimatePresence mode="popLayout">
              {group.posts.map((post) => (
                <ContextMenu key={post.id}>
                  <ContextMenuTrigger asChild>
                    <motion.tr
                      variants={{
                        hidden: { opacity: 0, filter: "blur(4px)" },
                        visible: { opacity: 1, filter: "blur(0px)" },
                      }}
                      layout
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.2 }}
                      aria-label={`Edit ${post.title}`}
                      className={cn(
                        "bg-transparent hover:bg-dash-row-hover data-[active=true]:bg-dash-row-active data-[selected=true]:bg-dash-row-selected", "group cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresco-tint-dimmed focus-visible:ring-inset",
                        loadingPosts?.has(post.id) && "pointer-events-none opacity-50 duration-300",
                      )}
                      data-active={post.id === activePostId}
                      data-selected={
                        hasSelection && selectedRows.has(post.id)
                          ? "true"
                          : undefined
                      }
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
                      {columns.map((column) => {
                        if (column.key === "status") {
                          const isLoading = loadingPosts?.has(post.id);
                          return (
                            <td
                              className={cn("text-sm text-[#888] hover:text-[#fff] font-normal", "border-b border-dash-content-border px-[22px] py-[13px] transition-colors group-hover:text-fresco-title group-data-[active=true]:text-fresco-title")}
                              key={column.key}
                            >
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={post.draft ? "draft" : "live"}
                                  initial={{ rotateX: 90, opacity: 0 }}
                                  animate={{ rotateX: 0, opacity: 1 }}
                                  exit={{ rotateX: -90, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <Badge
                                    className={cn(
                                      "h-5 rounded-full px-2 text-sm font-normal data-[loading=true]:bg-transparent data-[loading=true]:opacity-80 transition-opacity",
                                      post.draft
                                        ? "border border-fresco-warning-callout-border bg-fresco-warning-callout-bg text-fresco-warning-callout-text"
                                        : "border border-[color-mix(in_srgb,var(--color-fresco-tint)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-fresco-tint)_14%,transparent)] text-[color-mix(in_srgb,var(--color-fresco-title)_92%,white)]",
                                    )}
                                    data-loading={isLoading}
                                    variant="outline"
                                  >
                                    {isLoading && <Spinner className="mr-1.5 size-3.5 animate-spin" />}
                                    {post.draft ? "Draft" : "Live"}
                                  </Badge>
                                </motion.div>
                              </AnimatePresence>
                            </td>
                          );
                        }

                        return (
                            <td
                              className={cn(
                                "text-sm font-normal text-[#888] hover:text-[#fff] ", "border-b border-dash-content-border px-[22px] py-[13px] transition-colors group-hover:text-fresco-title group-data-[active=true]:text-fresco-title",
                                column.key === "title" && "",
                              )}
                            key={column.key}
                            title={String(getCellValue(post, metadata, column.key))}
                          >
                            {column.key === "title" ? (
                              <div className="flex min-w-0 items-center gap-3 text-inherit">
                                <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                                  {hasSelection && (
                                    <Checkbox
                                      aria-label={`Select ${post.title}`}
                                      checked={selectedRows.has(post.id)}
                                      className={cn(
                                        "absolute inset-0 transition-opacity",
                                        isSelectionMode || selectedRows.has(post.id)
                                          ? "opacity-100"
                                          : "opacity-0 group-hover:opacity-100",
                                      )}
                                      onCheckedChange={() => {
                                        // Selection is handled by click for shift-key detection.
                                      }}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleRowSelection(
                                          event,
                                          post.id,
                                          flatPostIds,
                                          lastClickedIndexRef,
                                          onToggleRow,
                                          onShiftClick,
                                        );
                                      }}
                                      onPointerDown={(event) => event.stopPropagation()}
                                    />
                                  )}
                                  <FileIcon
                                    className={cn(
                                      "pointer-events-none size-4 transition-opacity",
                                      hasSelection &&
                                        (isSelectionMode || selectedRows.has(post.id))
                                        ? "opacity-0"
                                        : "opacity-100 group-hover:opacity-0",
                                    )}
                                  />
                                </span>
                                {nudges?.has(post.id) && onNudgeClick && (
                                  <button
                                    aria-label={`AI suggestions for ${post.title}`}
                                    className="ml-1.5 inline-flex shrink-0 items-center justify-center rounded-md p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      const nudge = nudges.get(post.id);
                                      if (nudge) onNudgeClick(post.id, nudge.prompt);
                                    }}
                                    title={nudges.get(post.id)!.issues.join(" · ")}
                                    type="button"
                                  >
                                    <Sparkle className="size-3.5" weight="duotone" />
                                  </button>
                                )}
                                <span className="max-w-full overflow-hidden whitespace-nowrap align-bottom">
                                  {post.title}
                                </span>
                                {onChatWithItem && (
                                  <button
                                    aria-label={`Chat about ${post.title}`}
                                    className="ml-2 inline-flex shrink-0 items-center justify-center rounded-md p-0.5 opacity-0 transition-opacity group-hover:opacity-100 text-[#888] hover:text-[#fff]"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onChatWithItem(post.id);
                                    }}
                                    title="Chat with item"
                                    type="button"
                                  >
                                    <ChatCircle className="size-4" weight="duotone" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              renderCellContent(post, metadata, column.key)
                            )}
                          </td>
                        );
                      })}
                    </motion.tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      disabled={actionsDisabled}
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
                          disabled={actionsDisabled}
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
              </AnimatePresence>
            </Fragment>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
