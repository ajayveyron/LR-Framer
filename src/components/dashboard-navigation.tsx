"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

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

function isWorkspaceRoute(pathname: string) {
  return (
    pathname.startsWith("/dashboard/settings") ||
    pathname.startsWith("/dashboard/team")
  );
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

  if (
    pendingPathname &&
    pendingPathname !== pathname &&
    isWorkspaceRoute(pathname) &&
    isWorkspaceRoute(pendingPathname)
  ) {
    return <>{children}</>;
  }

  if (pendingPathname && pendingPathname !== pathname) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-4 sm:p-7">
        <div className="framer-subtle-panel flex min-w-[220px] items-center justify-center gap-3 px-6 py-5 text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
          <Spinner className="size-4" />
          <span>Loading view...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
