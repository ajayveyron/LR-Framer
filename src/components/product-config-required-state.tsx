export function ProductConfigRequiredState({
  issues,
}: {
  issues: Array<{ path: string; message: string }>;
}) {
  return (
    <section className="framer-shell grid place-items-center">
      <div className="framer-frame w-full max-w-7xl">
        <span className="framer-kicker">Configuration Required</span>
        <h1 className="mt-3 font-heading text-[clamp(30px,6vw,54px)] leading-[1.02] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
          Framer Bot is missing product environment variables.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
          Add the missing auth, Convex, and encryption variables before using
          the hosted product shell.
        </p>
        <div className="mt-5 grid gap-3">
          {issues.map((issue) => (
            <div
              className="framer-subtle-panel grid gap-1 px-4 py-3"
              key={`${issue.path}-${issue.message}`}
            >
              <strong className="text-sm text-[color:var(--framer-fresco-panelTitle-color)]">
                {issue.path}
              </strong>
              <span className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
                {issue.message}
              </span>
            </div>
          ))}
        </div>
        <pre className="framer-elevated-panel mt-5 overflow-auto p-[18px] font-mono text-sm text-[color:var(--framer-fresco-panelTitle-color)]">
          {`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
PRODUCT_ENCRYPTION_KEY=replace-with-a-long-random-string`}
        </pre>
      </div>
    </section>
  );
}
