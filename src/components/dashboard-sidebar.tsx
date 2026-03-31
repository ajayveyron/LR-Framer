"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  List as MenuIcon,
  Lightning,
  Rows,
  UsersThree,
  Sliders,
  ArrowsLeftRight,
  X,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { useOrganization, useOrganizationList } from "@clerk/nextjs";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
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
    matches: (pathname) => pathname === "/dashboard",
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
    matches: (pathname) => pathname === "/dashboard",
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
          <span className="flex text-sm items-center gap-2.5">
            <Icon weight="fill" />
            <span>{item.label}</span>
          </span>
        );

        const linkClassName = cn(
          "flex min-h-10 items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-[12px] font-medium tracking-[-0.01em] text-dash-nav-text transition-colors hover:bg-dash-nav-hover hover:text-fresco-title",
          active && "border-dash-control-border bg-dash-nav-active shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] text-fresco-title",
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

function WorkspaceSwitcher() {
  const { organization } = useOrganization();
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  if ((userMemberships?.data?.length ?? 0) < 2) return null;

  return (
    <Link
      className="flex items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-[12px] font-medium tracking-[-0.01em] text-dash-nav-text transition-colors hover:bg-dash-nav-hover hover:text-fresco-title"
      href="/select-workspace"
    >
      <ArrowsLeftRight weight="bold" />
      <span className="truncate">{organization?.name ?? "Switch workspace"}</span>
    </Link>
  );
}

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  const pathname = usePathname();
  const items = getNavItems(role);
  const activeItem = getActiveItem(pathname, items);

  return (
    <>
      <aside className={cn("flex h-full flex-col overflow-y-auto overscroll-contain border-r border-dash-control-border bg-dash-sidebar px-5 py-6 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]", "hidden md:flex")}>
        <div className="grid gap-2">
          <Link
            aria-label="Go to Content"
            className="mb-1 flex items-center gap-1"
            draggable={false}
            href="/dashboard"
          >
            <BrandLogo height={38} />
            <span className="select-none text-[17px] font-semibold tracking-[-0.02em] text-fresco-title">FramerBot</span>
          </Link>

          <DashboardNav pathname={pathname} role={role} />
        </div>

        <div className="mt-auto pt-4 grid gap-1" id="sidebar-insights-slot">
          <WorkspaceSwitcher />
        </div>
      </aside>

      <div className={cn("sticky top-0 z-30 flex items-center justify-between border-b border-dash-control-border bg-dash-topbar px-4 py-3 backdrop-blur-[14px]", "md:hidden")}>
        <div>
          <Link
            aria-label="Go to Content"
            className="flex items-center gap-2"
            draggable={false}
            href="/dashboard"
          >
            <BrandLogo height={32} />
            <span className="select-none text-[15px] font-semibold tracking-[-0.02em] text-fresco-title">FramerBot</span>
          </Link>
          <div className="text-[12px] text-dash-nav-text">
            {activeItem.label}
          </div>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              aria-label="Open navigation"
              className={cn("border border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-dash-control-hover hover:not-disabled:text-fresco-title focus-visible:not-disabled:bg-dash-control-hover focus-visible:not-disabled:text-fresco-title", "rounded-xl border text-fresco-title")}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            className="border-dash-control-border bg-[#101011] p-0 text-fresco-text"
            side="left"
            showCloseButton={false}
          >
            <div className="flex items-center justify-between border-b border-dash-control-border px-4 py-4">
              <div className="min-w-0">
                <SheetTitle asChild>
                  <Link
                    aria-label="Go to Content"
                    className="flex items-center gap-2"
                    draggable={false}
                    href="/dashboard"
                  >
                    <BrandLogo height={28} />
                    <span className="select-none text-[14px] font-semibold tracking-[-0.02em] text-fresco-title">FramerBot</span>
                  </Link>
                </SheetTitle>
                <SheetDescription className="sr-only">Dashboard navigation menu</SheetDescription>
                <div className="text-[12px] text-dash-nav-text">
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
