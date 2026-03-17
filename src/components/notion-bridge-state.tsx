import type { CSSProperties } from "react";

type NotionBridgeStateProps = {
  status?: {
    configured: boolean;
    issues: Array<{ path: string; message: string }>;
    webhookPath: string;
    manualSyncPath: string;
    manualImportPath: string;
    dataSourceId: string | null;
    statusPropertyName: string;
    approvedStatusValue: string;
    slugPropertyName: string;
    framerItemIdPropertyName: string;
    fieldMap: Record<string, string>;
  };
};

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
};

const fallbackStatus = {
  configured: false,
  issues: [],
  webhookPath: "/api/notion/webhook",
  manualSyncPath: "/api/notion/sync",
  manualImportPath: "/api/notion/import",
  dataSourceId: null,
  statusPropertyName: "Status",
  approvedStatusValue: "Approved",
  slugPropertyName: "Slug",
  framerItemIdPropertyName: "Framer Item ID",
  fieldMap: {},
};

function truncateMiddle(value: string, visible = 8) {
  if (value.length <= visible * 2) {
    return value;
  }

  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}

export function NotionBridgeState({ status }: NotionBridgeStateProps) {
  const resolvedStatus = status ?? fallbackStatus;

  return (
    <section className="panel stack">
      <div className="field-row">
        <div>
          <span className="eyebrow">Notion Bridge</span>
          <h2 style={{ marginTop: 8 }}>
            {resolvedStatus.configured ? "Ready for webhook sync" : "Optional backend bridge"}
          </h2>
          <p className="muted" style={{ marginTop: 8 }}>
            The dashboard can still be used manually. When this bridge is configured,
            approved Notion items can be pushed into the same Framer collection,
            published automatically, removed again when they leave the approved state,
            and existing Framer posts can be backfilled into Notion for future editing.
          </p>
        </div>
      </div>

      <div className={resolvedStatus.configured ? "success-banner" : "warning-banner"}>
        {resolvedStatus.configured
          ? `Configured for data source ${truncateMiddle(resolvedStatus.dataSourceId ?? "")}.`
          : "Notion sync is not configured yet."}
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <div className="field-row">
          <strong>Webhook route</strong>
          <span className="mono">{resolvedStatus.webhookPath}</span>
        </div>
        <div className="field-row">
          <strong>Manual sync route</strong>
          <span className="mono">{resolvedStatus.manualSyncPath}</span>
        </div>
        <div className="field-row">
          <strong>Framer import route</strong>
          <span className="mono">{resolvedStatus.manualImportPath}</span>
        </div>
        <div className="field-row">
          <strong>Approval rule</strong>
          <span className="mono">
            {resolvedStatus.statusPropertyName} = {resolvedStatus.approvedStatusValue}
          </span>
        </div>
        <div className="field-row">
          <strong>Slug property</strong>
          <span className="mono">{resolvedStatus.slugPropertyName}</span>
        </div>
        <div className="field-row">
          <strong>Framer item ID property</strong>
          <span className="mono">{resolvedStatus.framerItemIdPropertyName}</span>
        </div>
      </div>

      {Object.keys(resolvedStatus.fieldMap).length > 0 ? (
        <pre className="warning-banner mono" style={preStyle}>
          {JSON.stringify(resolvedStatus.fieldMap, null, 2)}
        </pre>
      ) : null}

      {!resolvedStatus.configured || resolvedStatus.issues.length > 0 ? (
        <div className="stack" style={{ gap: 10 }}>
          {resolvedStatus.issues.map((issue) => (
            <div className="field-row" key={`${issue.path}-${issue.message}`}>
              <strong className="mono">{issue.path}</strong>
              <span className="muted">{issue.message}</span>
            </div>
          ))}
          <pre className="warning-banner mono" style={preStyle}>
{`NOTION_API_KEY=secret_xxx
NOTION_DATA_SOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_WEBHOOK_SECRET=choose-a-long-random-secret
NOTION_STATUS_PROPERTY_NAME=Status
NOTION_APPROVED_STATUS_VALUE=Approved
NOTION_SLUG_PROPERTY_NAME=Slug
NOTION_FRAMER_ITEM_ID_PROPERTY_NAME=Framer Item ID
NOTION_FIELD_MAP={"author":"Writer","date":"Publish Date","createdAt":"CMS Created At","lastUpdated":"CMS Updated At"}`}
          </pre>
        </div>
      ) : null}

      {resolvedStatus.configured ? (
        <div className="warning-banner">
          <span className="mono">POST {resolvedStatus.manualSyncPath}</span> pushes
          approved Notion pages into Framer.{" "}
          <span className="mono">POST {resolvedStatus.manualImportPath}</span> backfills
          current Framer posts into Notion.
        </div>
      ) : null}
    </section>
  );
}
