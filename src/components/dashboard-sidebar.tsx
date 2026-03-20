"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  List as MenuIcon,
  Lightning,
  Rows,
  Sliders,
  UsersThree,
  X,
} from "@phosphor-icons/react";

import { DashboardAccountLink } from "@/components/dashboard-account-link";
import { LoadingLink } from "@/components/loading-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SiteRole } from "@/lib/product-types";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  role: SiteRole;
  siteName: string;
};

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  matches: (pathname: string) => boolean;
};

const contributorItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: Rows,
    label: "Content",
    matches: (pathname) =>
      pathname === "/dashboard" || pathname.startsWith("/dashboard/posts/"),
  },
  {
    href: "/dashboard/billing",
    icon: Lightning,
    label: "Usage & Billing",
    matches: (pathname) => pathname.startsWith("/dashboard/billing"),
  },
  {
    href: "/dashboard/settings",
    icon: Sliders,
    label: "Settings",
    matches: (pathname) => pathname.startsWith("/dashboard/settings"),
  },
];

const adminItems: NavItem[] = [
  ...contributorItems,
  {
    href: "/dashboard/team",
    icon: UsersThree,
    label: "Team",
    matches: (pathname) => pathname.startsWith("/dashboard/team"),
  },
];

function getNavItems(role: SiteRole) {
  return role === "admin" ? adminItems : contributorItems;
}

function getActiveItem(pathname: string, items: NavItem[]) {
  return items.find((item) => item.matches(pathname)) ?? items[0];
}

function DashboardNav({
  pathname,
  role,
  withSheetClose = false,
}: {
  pathname: string;
  role: SiteRole;
  withSheetClose?: boolean;
}) {
  const items = getNavItems(role);

  return (
    <nav aria-label="Dashboard sections" className="grid gap-1.5">
      {items.map((item) => {
        const active = item.matches(pathname);
        const Icon = item.icon;
        const content = (
          <span className="flex items-center gap-3">
            <Icon className="size-4" />
            <span>{item.label}</span>
          </span>
        );

        const linkClassName = cn(
          "dashboard-sidebar-link",
          active && "dashboard-sidebar-link-active",
        );

        if (withSheetClose) {
          return (
            <SheetClose asChild key={item.href}>
              <LoadingLink
                className={linkClassName}
                href={item.href}
                pendingClassName="opacity-80"
              >
                {content}
              </LoadingLink>
            </SheetClose>
          );
        }

        return (
          <LoadingLink
            className={linkClassName}
            href={item.href}
            key={item.href}
            pendingClassName="opacity-80"
          >
            {content}
          </LoadingLink>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar({ role, siteName }: DashboardSidebarProps) {
  const pathname = usePathname();
  const items = getNavItems(role);
  const activeItem = getActiveItem(pathname, items);

  return (
    <>
      <aside className="dashboard-sidebar hidden md:flex">
        <div className="grid gap-8">
          <div className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--framer-fresco-panelTitle-color)]">
            FramerBot
          </div>

          <DashboardNav pathname={pathname} role={role} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--framer-fresco-panelDivider-color)] pt-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
              Account
            </div>
            <div className="text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
              Profile and session
            </div>
          </div>
          <DashboardAccountLink />
        </div>
      </aside>

      <div className="dashboard-mobile-bar md:hidden">
        <div>
          <div className="text-base font-semibold tracking-[-0.03em] text-[color:var(--framer-fresco-panelTitle-color)]">
            FramerBot
          </div>
          <div className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
            {activeItem.label}
          </div>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              aria-label="Open navigation"
              className="border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] text-[color:var(--framer-fresco-panelTitle-color)] hover:bg-[var(--framer-fresco-buttonBackgroundHover-color)]"
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            className="border-[var(--framer-fresco-panelDivider-color)] bg-[#111111] p-0 text-[color:var(--framer-fresco-settingsText-color)]"
            side="left"
            showCloseButton={false}
          >
            <div className="flex items-center justify-between border-b border-[var(--framer-fresco-panelDivider-color)] px-4 py-4">
              <div className="min-w-0">
                <SheetTitle className="truncate text-left text-base font-semibold text-[color:var(--framer-fresco-panelTitle-color)]">
                  FramerBot
                </SheetTitle>
                <div className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                  {activeItem.label}
                </div>
              </div>
              <SheetClose asChild>
                <Button
                  aria-label="Close navigation"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              </SheetClose>
            </div>

            <div className="grid gap-8 px-4 py-5">
              <DashboardNav
                pathname={pathname}
                role={role}
                withSheetClose
              />

              <div className="flex items-center justify-between gap-3 border-t border-[var(--framer-fresco-panelDivider-color)] pt-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
                    Account
                  </div>
                  <div className="text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
                    Profile and session
                  </div>
                </div>
                <DashboardAccountLink />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
