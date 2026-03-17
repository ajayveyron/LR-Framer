export function ConfigRequiredState({
  issues,
}: {
  issues: Array<{ path: string; message: string }>;
}) {
  return (
    <section className="panel stack">
      <span className="eyebrow">Configuration Required</span>
      <h2>Framer API key is not set yet.</h2>
      <p className="muted">
        Add the missing secret to <span className="mono">.env</span> and
        restart the dev server before testing fetch, create, or update against
        Framer.
      </p>
      <div className="warning-banner">
        Required for live CMS access: <span className="mono">FRAMER_API_KEY</span>.
      </div>
      <p className="muted">
        The Framer project and collection are pinned in code for this internal deployment.
      </p>
      <div className="stack" style={{ gap: 10 }}>
        {issues.map((issue) => (
          <div className="field-row" key={`${issue.path}-${issue.message}`}>
            <strong className="mono">{issue.path}</strong>
            <span className="muted">{issue.message}</span>
          </div>
        ))}
      </div>
      <pre className="warning-banner mono" style={{ whiteSpace: "pre-wrap" }}>
{`FRAMER_API_KEY=ap_your_server_api_key`}
      </pre>
    </section>
  );
}
