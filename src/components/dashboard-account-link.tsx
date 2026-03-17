"use client";

import Link from "next/link";

import { useUser } from "@clerk/nextjs";
import { Sliders as Settings2Icon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "A";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DashboardAccountLink() {
  const { isLoaded, user } = useUser();
  const fullName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Account";
  const email = user?.primaryEmailAddress?.emailAddress ?? "Open settings";

  return (
    <Button
      asChild
      className="h-11 min-w-0 max-w-full gap-3 px-3.5 md:max-w-[320px]"
      size="sm"
      variant="outline"
    >
      <Link href="/dashboard/settings">
        <span className="inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-subtle-color)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelTitle-color)]">
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={fullName}
              className="size-full object-cover"
              loading="lazy"
              src={user.imageUrl}
            />
          ) : (
            <span>{getInitials(fullName)}</span>
          )}
        </span>
        <span className="hidden min-w-0 flex-1 text-left sm:flex sm:flex-col">
          <span className="truncate text-sm font-semibold text-[color:var(--framer-fresco-panelTitle-color)]">
            {isLoaded ? fullName : "Account"}
          </span>
          <span className="truncate text-[11px] text-[color:var(--framer-fresco-panelSubtitle-color)]">
            {email}
          </span>
        </span>
        <span className="hidden text-xs font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)] lg:inline-flex">
          Settings
        </span>
        <Settings2Icon className="size-4 shrink-0 text-[color:var(--framer-fresco-panelSubtitle-color)]" />
      </Link>
    </Button>
  );
}
