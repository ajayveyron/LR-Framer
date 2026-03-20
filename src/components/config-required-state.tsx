export function ConfigRequiredState({
  issues,
}: {
  issues: Array<{ path: string; message: string }>;
}) {
  return (
    <section className="rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)] flex flex-col gap-4">
      <span className="inline-flex items-center rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--framer-fresco-panelSubtitle-color)] w-fit">Configuration Required</span>
      <h2 className="font-heading text-[clamp(28px,4vw,40px)] leading-[1.06] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
        Framer API key is not set yet.
      </h2>
      <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
        Add the missing secret to <span className="font-mono">.env</span> and
        restart the dev server before testing fetch, create, or update against
        Framer.
      </p>
      <div className="rounded-none border border-[var(--framer-app-accent-callout-border-color)] bg-[var(--framer-app-accent-callout-background-color)] px-4 py-3 text-sm text-[color:var(--framer-app-accent-callout-text-color)]">
        Required for live CMS access:{" "}
        <span className="font-mono">FRAMER_API_KEY</span>.
      </div>
      <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
        The Framer project and collection are pinned in code for this internal
        deployment.
      </p>
      <div className="grid gap-2.5">
        {issues.map((issue) => (
          <div
            className="rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-subtle-color)] flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            key={`${issue.path}-${issue.message}`}
          >
            <strong className="font-mono text-sm text-[color:var(--framer-fresco-panelTitle-color)]">
              {issue.path}
            </strong>
            <span className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
              {issue.message}
            </span>
          </div>
        ))}
      </div>
      <pre className="rounded-none border border-[var(--framer-app-accent-callout-border-color)] bg-[var(--framer-app-accent-callout-background-color)] px-4 py-3 font-mono text-sm text-[color:var(--framer-app-accent-callout-text-color)] whitespace-pre-wrap">
        {`FRAMER_API_KEY=ap_your_server_api_key`}
      </pre>
    </section>
  );
}
