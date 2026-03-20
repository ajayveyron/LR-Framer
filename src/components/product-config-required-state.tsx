export function ProductConfigRequiredState({
  issues,
}: {
  issues: Array<{ path: string; message: string }>;
}) {
  return (
    <section className="min-h-screen min-h-dvh overflow-y-auto overscroll-none bg-[var(--background)] p-4 sm:p-7 grid place-items-center">
      <div className="rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[linear-gradient(180deg,var(--framer-app-frame-overlay-color),transparent),var(--framer-fresco-panelBackground-color)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] w-full max-w-7xl">
        <span className="inline-flex items-center rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--framer-fresco-panelSubtitle-color)]">Configuration Required</span>
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
              className="rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-subtle-color)] grid gap-1 px-4 py-3"
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
        <pre className="rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-elevated-color)] shadow-[inset_0_1px_0_var(--framer-app-frame-overlay-color),0_8px_24px_rgba(0,0,0,0.12)] mt-5 overflow-auto p-[18px] font-mono text-sm text-[color:var(--framer-fresco-panelTitle-color)]">
          {`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
PRODUCT_ENCRYPTION_KEY=replace-with-a-long-random-string`}
        </pre>
      </div>
    </section>
  );
}
