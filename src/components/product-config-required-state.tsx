export function ProductConfigRequiredState({
  issues,
}: {
  issues: Array<{ path: string; message: string }>;
}) {
  return (
    <section className="min-h-screen min-h-dvh overflow-y-auto overscroll-none bg-[var(--background)] p-4 sm:p-7 grid place-items-center">
      <div className="rounded-none border border-fresco-divider bg-[linear-gradient(180deg,var(--color-fresco-frame-overlay),transparent),var(--color-fresco-panel)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] w-full max-w-7xl">
        <span className="inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle">Configuration Required</span>
        <h1 className="mt-3 font-heading text-[clamp(30px,6vw,54px)] leading-[1.02] tracking-[-0.04em] text-fresco-title">
          Framer Bot is missing product environment variables.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-fresco-description">
          Add the missing auth, Convex, and encryption variables before using
          the hosted product shell.
        </p>
        <div className="mt-5 grid gap-3">
          {issues.map((issue) => (
            <div
              className="rounded-none border border-fresco-divider bg-fresco-surface-subtle grid gap-1 px-4 py-3"
              key={`${issue.path}-${issue.message}`}
            >
              <strong className="text-sm text-fresco-title">
                {issue.path}
              </strong>
              <span className="text-sm leading-6 text-fresco-description">
                {issue.message}
              </span>
            </div>
          ))}
        </div>
        <pre className="rounded-none border border-fresco-divider bg-fresco-surface-elevated shadow-[inset_0_1px_0_var(--color-fresco-frame-overlay),0_8px_24px_rgba(0,0,0,0.12)] mt-5 overflow-auto p-[18px] font-mono text-sm text-fresco-title">
          {`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
PRODUCT_ENCRYPTION_KEY=replace-with-a-long-random-string`}
        </pre>
      </div>
    </section>
  );
}
