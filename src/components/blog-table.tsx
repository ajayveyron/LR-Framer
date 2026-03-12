"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

import type {
  BlogCollectionMetadata,
  BlogPostRecord,
  DashboardFieldDefinition,
  DashboardFieldValue,
} from "@/lib/cms-types";

type BlogTableProps = {
  activePostId?: string | null;
  columns: Array<{ key: string; label: string }>;
  metadata: BlogCollectionMetadata;
  posts: BlogPostRecord[];
};

type ColumnLimits = {
  defaultWidth: number;
  maxWidth: number;
  minWidth: number;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
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
      return { defaultWidth: 280, minWidth: 180, maxWidth: 520 };
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
    return "Not set";
  }

  if (Array.isArray(value)) {
    if (field?.type === "array") {
      return `${value.length} item${value.length === 1 ? "" : "s"}`;
    }

    return value.length > 0 ? value.join(", ") : "Not set";
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
    return "Not set";
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
      <Link
        aria-label={`Edit ${post.title}`}
        className="table-row-link table-title-cell"
        href={`/posts/${post.id}`}
      >
        <span className="doc-glyph" aria-hidden="true">
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
        <span className="table-value">{post.title}</span>
      </Link>
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
          className="image-preview"
          loading="lazy"
          src={value}
        />
      );
    }
  }

  return <span className="table-value">{getCellValue(post, metadata, columnKey)}</span>;
}

export function BlogTable({ activePostId = null, columns, metadata, posts }: BlogTableProps) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      columns.map((column) => [
        column.key,
        getColumnLimits(metadata, column.key).defaultWidth,
      ]),
    ),
  );
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      document.body.classList.remove("table-resizing");
    };
  }, []);

  if (posts.length === 0) {
    return (
      <div className="empty-state">
        <strong>No posts loaded yet.</strong>
        <p className="muted">Add your first draft post.</p>
      </div>
    );
  }

  const tableMinWidth =
    columns.reduce(
      (sum, column) =>
        sum + (columnWidths[column.key] ?? getColumnLimits(metadata, column.key).defaultWidth),
      0,
    );

  const groupedPosts = [
    { key: "drafts", label: "Drafts", posts: posts.filter((post) => post.draft) },
    { key: "published", label: "Published", posts: posts.filter((post) => !post.draft) },
  ].filter((group) => group.posts.length > 0);

  return (
    <div className="table-wrap">
      <table style={{ minWidth: tableMinWidth }}>
        <colgroup>
          {columns.map((column) => {
            const width =
              columnWidths[column.key] ??
              getColumnLimits(metadata, column.key).defaultWidth;

            return <col key={column.key} style={{ width }} />;
          })}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.key === "slug" ? "mono" : undefined} key={column.key}>
                <div className="table-head-cell">
                  <span>{column.label}</span>
                  <button
                    aria-label={`Resize ${column.label} column`}
                    className={`column-resizer ${
                      draggingColumn === column.key ? "column-resizer-active" : ""
                    }`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();

                      const limits = getColumnLimits(metadata, column.key);
                      const startWidth =
                        columnWidths[column.key] ?? limits.defaultWidth;
                      const startX = event.clientX;

                      setDraggingColumn(column.key);
                      document.body.classList.add("table-resizing");

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
                        document.body.classList.remove("table-resizing");
                        window.removeEventListener("pointermove", handlePointerMove);
                        window.removeEventListener("pointerup", stopDragging);
                        window.removeEventListener("pointercancel", stopDragging);
                      };

                      window.addEventListener("pointermove", handlePointerMove);
                      window.addEventListener("pointerup", stopDragging);
                      window.addEventListener("pointercancel", stopDragging);
                    }}
                    type="button"
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupedPosts.map((group) => (
            <Fragment key={group.key}>
              <tr className="table-group-row" key={`${group.key}-label`}>
                <td colSpan={columns.length}>{group.label}</td>
              </tr>
              {group.posts.map((post) => (
                <tr
                  className={`table-row ${post.id === activePostId ? "table-row-active" : ""}`}
                  key={post.id}
                >
                  {columns.map((column) => {
                    if (column.key === "status") {
                      return (
                        <td key={column.key}>
                          <span
                            className={`status-chip ${
                              post.draft ? "status-draft" : "status-published"
                            }`}
                          >
                            {post.draft ? "Draft" : "Live"}
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td
                        className={column.key === "slug" ? "mono" : undefined}
                        key={column.key}
                        title={String(getCellValue(post, metadata, column.key))}
                      >
                        {renderCellContent(post, metadata, column.key)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
