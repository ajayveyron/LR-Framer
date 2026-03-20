export function DashboardTableSkeleton() {
  return (
    <section className="relative min-w-0 overflow-x-clip">
      <div className="min-h-full min-w-0 bg-[var(--framer-fresco-panelBackground-color)] shadow-[inset_0_1px_0_var(--framer-app-frame-overlay-color)] md:border md:border-[var(--framer-dashboard-content-border-color)]">
        <div className={`bg-[var(--framer-dashboard-topbar-color)] backdrop-blur-[14px] sticky top-0 z-20`}>
          <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--framer-dashboard-content-border-color)] px-4 py-3">
            <div className="h-10 w-[108px] animate-pulse rounded-xl bg-[var(--framer-dashboard-control-background-color)]" />
            <div className="h-10 flex-[0_1_32rem] animate-pulse rounded-xl bg-[var(--framer-dashboard-control-background-color)]" />
            <div className="ml-auto h-10 w-[128px] animate-pulse rounded-xl bg-[var(--framer-dashboard-control-background-color)]" />
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-2">
              <div className="h-4 w-36 animate-pulse rounded-full bg-[var(--framer-dashboard-control-background-color)]" />
              <div className="h-3 w-52 animate-pulse rounded-full bg-[var(--framer-dashboard-control-background-color)]" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-[var(--framer-dashboard-control-background-color)]" />
          </div>
          <div className="overflow-hidden border border-[var(--framer-dashboard-content-border-color)] bg-[var(--framer-fresco-panelBackground-color)]">
            <div className="grid grid-cols-[minmax(220px,2.2fr)_minmax(160px,1.2fr)_minmax(140px,0.9fr)_minmax(180px,1.1fr)] border-b border-[var(--framer-dashboard-content-border-color)] bg-[var(--framer-dashboard-group-background-color)] px-[22px] py-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`header-${index}`}
                  className="h-3 w-20 animate-pulse rounded-full bg-[var(--framer-fresco-panelDivider-color)]/70"
                />
              ))}
            </div>
            <div className="px-[22px] py-2">
              {Array.from({ length: 8 }).map((_, rowIndex) => (
                <div
                  key={`row-${rowIndex}`}
                  className="grid grid-cols-[minmax(220px,2.2fr)_minmax(160px,1.2fr)_minmax(140px,0.9fr)_minmax(180px,1.1fr)] gap-6 border-b border-[var(--framer-dashboard-content-border-color)] py-3.5 last:border-b-0"
                >
                  <div className="h-4 w-3/4 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]" />
                  <div className="h-4 w-5/6 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]" />
                  <div className="h-5 w-14 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]" />
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--framer-dashboard-content-border-color)] px-5 py-3">
          <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 animate-pulse rounded-lg bg-[var(--framer-dashboard-control-background-color)]" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-[var(--framer-dashboard-control-background-color)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
