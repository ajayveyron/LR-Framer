
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
    <section className="rounded-none border border-fresco-divider bg-fresco-panel p-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)] flex flex-col gap-4">
      <div>
        <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle w-fit">Notion Bridge</span>
        <h2 className="mt-2 font-heading text-[clamp(28px,4vw,40px)] leading-[1.06] tracking-[-0.04em] text-fresco-title">
            {resolvedStatus.configured ? "Ready for webhook sync" : "Optional backend bridge"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-fresco-description">
            The dashboard can still be used manually. When this bridge is configured,
            approved Notion items can be pushed into the same Framer collection,
            published automatically, removed again when they leave the approved state,
            and existing Framer posts can be backfilled into Notion for future editing.
        </p>
        <p className="mt-2 text-sm leading-6 text-fresco-description">
          The Notion data source, property names, and field mapping are pinned in code for this
          deployment. Only the bridge secrets live in <span className="font-mono">.env</span>.
        </p>
      </div>

      <div
        className={
          resolvedStatus.configured
            ? "rounded-none border border-fresco-success-callout-border bg-fresco-success-callout-bg px-4 py-3 text-sm text-fresco-success-callout-text"
            : "rounded-none border border-fresco-accent-callout-border bg-fresco-accent-callout-bg px-4 py-3 text-sm text-fresco-accent-callout-text"
        }
      >
        {resolvedStatus.configured
          ? `Configured for data source ${truncateMiddle(resolvedStatus.dataSourceId ?? "")}.`
          : "Notion sync is not configured yet."}
      </div>

      <div className="grid gap-2.5">
        <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <strong className="text-sm text-fresco-title">Webhook route</strong>
          <span className="font-mono text-sm text-fresco-subtitle">
            {resolvedStatus.webhookPath}
          </span>
        </div>
        <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <strong className="text-sm text-fresco-title">Manual sync route</strong>
          <span className="font-mono text-sm text-fresco-subtitle">
            {resolvedStatus.manualSyncPath}
          </span>
        </div>
        <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <strong className="text-sm text-fresco-title">Framer import route</strong>
          <span className="font-mono text-sm text-fresco-subtitle">
            {resolvedStatus.manualImportPath}
          </span>
        </div>
        <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <strong className="text-sm text-fresco-title">Approval rule</strong>
          <span className="font-mono text-sm text-fresco-subtitle">
            {resolvedStatus.statusPropertyName} = {resolvedStatus.approvedStatusValue}
          </span>
        </div>
        <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <strong className="text-sm text-fresco-title">Slug property</strong>
          <span className="font-mono text-sm text-fresco-subtitle">
            {resolvedStatus.slugPropertyName}
          </span>
        </div>
        <div className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <strong className="text-sm text-fresco-title">Framer item ID property</strong>
          <span className="font-mono text-sm text-fresco-subtitle">
            {resolvedStatus.framerItemIdPropertyName}
          </span>
        </div>
      </div>

      {Object.keys(resolvedStatus.fieldMap).length > 0 ? (
        <pre className="rounded-none border border-fresco-accent-callout-border bg-fresco-accent-callout-bg px-4 py-3 font-mono text-sm text-fresco-accent-callout-text whitespace-pre-wrap">
          {JSON.stringify(resolvedStatus.fieldMap, null, 2)}
        </pre>
      ) : null}

      {!resolvedStatus.configured || resolvedStatus.issues.length > 0 ? (
        <div className="grid gap-2.5">
          {resolvedStatus.issues.map((issue) => (
            <div
              className="rounded-none border border-fresco-divider bg-fresco-surface-subtle flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              key={`${issue.path}-${issue.message}`}
            >
              <strong className="font-mono text-sm text-fresco-title">
                {issue.path}
              </strong>
              <span className="text-sm text-fresco-description">
                {issue.message}
              </span>
            </div>
          ))}
          <pre className="rounded-none border border-fresco-accent-callout-border bg-fresco-accent-callout-bg px-4 py-3 font-mono text-sm text-fresco-accent-callout-text whitespace-pre-wrap">
{`NOTION_API_KEY=secret_xxx
NOTION_WEBHOOK_SECRET=choose-a-long-random-secret`}
          </pre>
        </div>
      ) : null}

      {resolvedStatus.configured ? (
        <div className="rounded-none border border-fresco-accent-callout-border bg-fresco-accent-callout-bg px-4 py-3 text-sm text-fresco-accent-callout-text">
          <span className="font-mono">POST {resolvedStatus.manualSyncPath}</span> pushes
          approved Notion pages into Framer.{" "}
          <span className="font-mono">POST {resolvedStatus.manualImportPath}</span> backfills
          current Framer posts into Notion.
        </div>
      ) : null}
    </section>
  );
}
