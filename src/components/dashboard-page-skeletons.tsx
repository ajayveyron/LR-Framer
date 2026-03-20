import { cn } from "@/lib/utils";

function SkeletonBlock({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-xl bg-[var(--framer-dashboard-control-background-color)]",
        className,
      )}
    />
  );
}

function DashboardPageFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="dashboard-page-shell">
      <section className="grid w-full gap-10">
        {children}
      </section>
    </main>
  );
}

function DashboardPageHeaderSkeleton() {
  return (
    <div className="grid gap-2">
      <SkeletonBlock className="h-8 w-40 rounded-lg" />
      <SkeletonBlock className="h-4 w-full max-w-2xl rounded-full" />
      <SkeletonBlock className="h-4 w-[78%] max-w-xl rounded-full" />
    </div>
  );
}

export function SettingsFormPanelSkeleton() {
  return (
    <section className="settings-section grid gap-5">
      <div className="grid gap-2">
        <SkeletonBlock className="h-6 w-40 rounded-lg" />
        <SkeletonBlock className="h-4 w-[72%] rounded-full" />
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="grid gap-2" key={`settings-field-${index}`}>
            <SkeletonBlock className="h-4 w-36 rounded-full" />
            <SkeletonBlock className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <SkeletonBlock className="h-10 w-40 rounded-lg" />
        <SkeletonBlock className="h-10 w-32 rounded-lg" />
      </div>
    </section>
  );
}

export function SettingsSessionPanelSkeleton() {
  return (
    <section className="settings-section grid gap-4">
      <div className="grid gap-2">
        <SkeletonBlock className="h-6 w-24 rounded-lg" />
        <SkeletonBlock className="h-4 w-[68%] max-w-lg rounded-full" />
      </div>

      <div>
        <SkeletonBlock className="h-10 w-28 rounded-lg" />
      </div>
    </section>
  );
}

export function TeamManagerContentSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-10 w-10 rounded-lg" />
        <div className="grid gap-2">
          <SkeletonBlock className="h-4 w-36 rounded-full" />
          <SkeletonBlock className="h-3 w-20 rounded-full" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <SkeletonBlock className="h-4 w-52 rounded-full" />
        <SkeletonBlock className="h-9 w-28 rounded-lg" />
      </div>

      <div className="flex items-center gap-6 border-b border-[var(--framer-dashboard-control-border-color)] pb-3">
        <SkeletonBlock className="h-5 w-24 rounded-full" />
        <SkeletonBlock className="h-5 w-28 rounded-full" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--framer-dashboard-control-border-color)]">
        <div className="grid grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_96px] gap-6 border-b border-[var(--framer-dashboard-control-border-color)] px-6 py-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock className="h-3 w-16 rounded-full" key={`team-header-${index}`} />
          ))}
        </div>
        <div className="grid gap-0 px-6 py-1">
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <div
              className="grid grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_96px] gap-6 border-b border-[var(--framer-dashboard-control-border-color)] py-4 last:border-b-0"
              key={`team-row-${rowIndex}`}
            >
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-8 w-8 rounded-full" />
                <div className="grid gap-2">
                  <SkeletonBlock className="h-4 w-36 rounded-full" />
                  <SkeletonBlock className="h-3 w-28 rounded-full" />
                </div>
              </div>
              <SkeletonBlock className="h-4 w-24 rounded-full self-center" />
              <SkeletonBlock className="h-8 w-20 rounded-lg self-center" />
              <SkeletonBlock className="h-8 w-8 rounded-lg justify-self-end self-center" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TeamManagerPanelSkeleton() {
  return (
    <section className="settings-section grid gap-6">
      <TeamManagerContentSkeleton />
    </section>
  );
}

export function BillingPanelSkeleton() {
  return (
    <section className="settings-section grid gap-6">
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-5 w-5 rounded-full" />
          <SkeletonBlock className="h-4 w-64 rounded-full" />
        </div>
        <SkeletonBlock className="h-2.5 w-full rounded-full" />
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-3 w-40 rounded-full" />
          <SkeletonBlock className="h-3 w-10 rounded-full" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-[var(--framer-dashboard-control-border-color)] pt-4">
        <SkeletonBlock className="h-9 w-40 rounded-lg" />
      </div>
    </section>
  );
}

export function SettingsPageSkeleton() {
  return (
    <DashboardPageFrame>
      <DashboardPageHeaderSkeleton />
      <SettingsFormPanelSkeleton />
      <SettingsSessionPanelSkeleton />
    </DashboardPageFrame>
  );
}

export function TeamPageSkeleton() {
  return (
    <DashboardPageFrame>
      <DashboardPageHeaderSkeleton />
      <TeamManagerPanelSkeleton />
    </DashboardPageFrame>
  );
}

export function BillingPageSkeleton() {
  return (
    <DashboardPageFrame>
      <DashboardPageHeaderSkeleton />
      <BillingPanelSkeleton />
    </DashboardPageFrame>
  );
}
