export function ConfigRequiredState({
  issues,
}: {
  issues: Array<{ path: string; message: string }>;
}) {
  return (
    <section className="framer-card flex flex-col gap-4">
      <span className="framer-kicker w-fit">Configuration Required</span>
      <h2 className="font-heading text-[clamp(28px,4vw,40px)] leading-[1.06] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
        Framer API key is not set yet.
      </h2>
      <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
        Add the missing secret to <span className="font-mono">.env</span> and
        restart the dev server before testing fetch, create, or update against
        Framer.
      </p>
      <div className="framer-callout-info">
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
            className="framer-subtle-panel flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
      <pre className="framer-code-panel whitespace-pre-wrap">
        {`FRAMER_API_KEY=ap_your_server_api_key`}
      </pre>
    </section>
  );
}
