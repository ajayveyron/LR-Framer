"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  List as MenuIcon,
  Lightning,
  Rows,
  UsersThree,
  Sliders,
  X,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

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
};

type NavItem = {
  href: string;
  icon: PhosphorIcon;
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
    href: "/dashboard/team",
    icon: UsersThree,
    label: "Team",
    matches: (pathname) => pathname.startsWith("/dashboard/team"),
  },
  {
    href: "/dashboard/settings",
    icon: Sliders,
    label: "Settings",
    matches: (pathname) => pathname.startsWith("/dashboard/settings"),
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
          <span className="flex items-center gap-2.5">
            <Icon className="size-[15px]" weight="fill" />
            <span>{item.label}</span>
          </span>
        );

        const linkClassName = cn(
          "flex min-h-10 items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-[12px] font-medium tracking-[-0.01em] text-[color:var(--framer-dashboard-nav-text-color)] transition-colors hover:bg-[var(--framer-dashboard-nav-hover-color)] hover:text-[color:var(--framer-fresco-panelTitle-color)]",
          active && "border-[var(--framer-dashboard-control-border-color)] bg-[var(--framer-dashboard-nav-active-color)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] text-[color:var(--framer-fresco-panelTitle-color)]",
        );

        if (withSheetClose) {
          return (
            <SheetClose asChild key={item.href}>
              <Link className={linkClassName} href={item.href}>
                {content}
              </Link>
            </SheetClose>
          );
        }

        return (
          <Link className={linkClassName} href={item.href} key={item.href}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  const pathname = usePathname();
  const items = getNavItems(role);
  const activeItem = getActiveItem(pathname, items);
  const brandClassName =
    "select-none text-[15px] font-semibold tracking-[-0.02em] text-[color:var(--framer-fresco-panelTitle-color)]";

  return (
    <>
      <aside className={cn("sticky flex-col overflow-y-auto overscroll-contain border-r border-[var(--framer-dashboard-control-border-color)] bg-[var(--framer-dashboard-sidebar-color)] px-5 py-6 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)] top-[var(--dashboard-banner-offset)] h-[calc(100dvh-var(--dashboard-banner-offset))]", "hidden md:flex")}>
        <div className="grid gap-8">
          <Link
            aria-label="Go to Content"
            className={brandClassName}
            draggable={false}
            href="/dashboard"
          >
            FramerBot
          </Link>

          <DashboardNav pathname={pathname} role={role} />
        </div>
      </aside>

      <div className={cn("sticky top-[var(--dashboard-banner-offset)] z-30 flex items-center justify-between border-b border-[var(--framer-dashboard-control-border-color)] bg-[var(--framer-dashboard-topbar-color)] px-4 py-3 backdrop-blur-[14px]", "md:hidden")}>
        <div>
          <Link
            aria-label="Go to Content"
            className={brandClassName}
            draggable={false}
            href="/dashboard"
          >
            FramerBot
          </Link>
          <div className="text-[12px] text-[color:var(--framer-dashboard-nav-text-color)]">
            {activeItem.label}
          </div>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              aria-label="Open navigation"
              className={cn("border border-[var(--framer-dashboard-control-border-color)] bg-[var(--framer-dashboard-control-background-color)] text-[color:var(--framer-dashboard-nav-text-color)] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-[var(--framer-dashboard-control-hover-color)] hover:not-disabled:text-[color:var(--framer-fresco-panelTitle-color)] focus-visible:not-disabled:bg-[var(--framer-dashboard-control-hover-color)] focus-visible:not-disabled:text-[color:var(--framer-fresco-panelTitle-color)]", "rounded-xl border text-[color:var(--framer-fresco-panelTitle-color)]")}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            className="border-[var(--framer-dashboard-control-border-color)] bg-[#101011] p-0 text-[color:var(--framer-fresco-settingsText-color)]"
            side="left"
            showCloseButton={false}
          >
            <div className="flex items-center justify-between border-b border-[var(--framer-dashboard-control-border-color)] px-4 py-4">
              <div className="min-w-0">
                <SheetTitle asChild>
                  <Link
                    aria-label="Go to Content"
                    className="truncate text-left select-none text-[15px] font-semibold text-[color:var(--framer-fresco-panelTitle-color)]"
                    draggable={false}
                    href="/dashboard"
                  >
                    FramerBot
                  </Link>
                </SheetTitle>
                <div className="text-[12px] text-[color:var(--framer-dashboard-nav-text-color)]">
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
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
