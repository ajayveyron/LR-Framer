"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

type DashboardNavigationContextValue = {
  pendingPathname: string | null;
  setPendingPathname: (pathname: string | null) => void;
};

const DashboardNavigationContext =
  React.createContext<DashboardNavigationContextValue | null>(null);

function normalizePathname(href: string) {
  if (typeof window === "undefined") {
    return href.split(/[?#]/, 1)[0] ?? href;
  }

  try {
    return new URL(href, window.location.href).pathname;
  } catch {
    return href.split(/[?#]/, 1)[0] ?? href;
  }
}

export function DashboardNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pendingPathname, setPendingPathname] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    setPendingPathname(null);
  }, [pathname]);

  const value = React.useMemo(
    () => ({ pendingPathname, setPendingPathname }),
    [pendingPathname],
  );

  return (
    <DashboardNavigationContext.Provider value={value}>
      {children}
    </DashboardNavigationContext.Provider>
  );
}

export function useDashboardPendingPathname() {
  return React.useContext(DashboardNavigationContext)?.pendingPathname ?? null;
}

export function useDashboardSetPendingPathname() {
  return (
    React.useContext(DashboardNavigationContext)?.setPendingPathname ??
    (() => undefined)
  );
}

export function useDashboardDisplayPathname() {
  const pathname = usePathname();
  const pendingPathname = useDashboardPendingPathname();

  return pendingPathname ?? pathname;
}

export function useNormalizedDashboardPathname(href: string) {
  return React.useMemo(() => normalizePathname(href), [href]);
}

export function DashboardMainTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pendingPathname = useDashboardPendingPathname();
  const isNavigating =
    pendingPathname !== null && pendingPathname !== pathname;

  return (
    <div className="relative min-h-0 flex-1">
      {/* Subtle top-edge loading bar while navigating */}
      {isNavigating ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden">
          <div className="h-full w-full animate-pulse bg-fresco-tint" />
        </div>
      ) : null}
      <div
        className={isNavigating ? "pointer-events-none opacity-60 transition-opacity duration-150" : undefined}
      >
        {children}
      </div>
    </div>
  );
}
