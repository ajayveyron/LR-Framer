"use client";

import Link from "next/link";
import { useState } from "react";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  SignOut as SignOutIcon,
  Sliders as Settings2Icon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBillingUsage, deriveMeterState, METER_COLORS } from "@/lib/use-billing-usage";

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

/**
 * SVG ring overlay that shows usage percentage around the avatar.
 * Only renders for free plan users.
 */
function UsageRing() {
  const { data, loading } = useBillingUsage();
  if (loading || !data || data.planName !== "Free") return null;

  const state = deriveMeterState(data.percentUsed);
  const color = METER_COLORS[state];

  // SVG circle math: radius 20, circumference ≈ 125.66
  const R = 20;
  const C = 2 * Math.PI * R;
  const filled = (Math.min(data.percentUsed, 100) / 100) * C;
  const gap = C - filled;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -rotate-90"
      viewBox="0 0 44 44"
      fill="none"
    >
      {/* Track */}
      <circle cx="22" cy="22" r={R} stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
      {/* Fill */}
      <circle
        cx="22"
        cy="22"
        r={R}
        stroke={color}
        strokeWidth="2"
        strokeDasharray={`${filled} ${gap}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease-out" }}
      />
    </svg>
  );
}

export function DashboardAccountLink() {
  const clerk = useClerk();
  const { isLoaded, user } = useUser();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const fullName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Account";

  return (
    <>
      <div className="group relative">
        <div className="relative">
          <UsageRing />
          <Button
            aria-label="Open account menu"
            className="size-11 rounded-full p-0"
            size="icon-lg"
            type="button"
            variant="outline"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-subtle-color)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelTitle-color)]">
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
          </Button>
        </div>
        <div className="pointer-events-none absolute right-0 top-full z-30 pt-2 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <div className="w-44 border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-menuBackground-color)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,0.42)]">
            <Link
              className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm text-[color:var(--framer-fresco-menuText-color)] transition-colors hover:bg-[var(--framer-fresco-menuBackgroundActive-color)] hover:text-[color:var(--framer-fresco-menuTextActive-color)]"
              href="/dashboard/settings"
            >
              <Settings2Icon className="size-4" />
              <span>{isLoaded ? "Settings" : "Account"}</span>
            </Link>
            <div className="my-1 h-px bg-[var(--framer-fresco-panelDivider-color)]" />
            <button
              className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-[color:var(--framer-fresco-errorTint-color)] transition-colors hover:bg-[var(--framer-app-danger-callout-background-color)] hover:text-[color:var(--framer-app-danger-callout-text-color)]"
              onClick={() => setConfirmLogoutOpen(true)}
              type="button"
            >
              <SignOutIcon className="size-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>

      <Dialog onOpenChange={setConfirmLogoutOpen} open={confirmLogoutOpen}>
        <DialogContent className="framer-dialog-panel border" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Log out?</DialogTitle>
            <DialogDescription>
              You&apos;ll be signed out of this workspace and returned to the home
              screen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-0 -mb-0 flex justify-end gap-2.5 border-0 bg-transparent p-0">
            <Button
              onClick={() => setConfirmLogoutOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void clerk.signOut({ redirectUrl: "/" });
              }}
              type="button"
              variant="destructive"
            >
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
