"use client";

import { useState } from "react";

import { useClerk, useUser } from "@clerk/nextjs";
import { SignOut as SignOutIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SettingsSessionPanel() {
  const clerk = useClerk();
  const { isLoaded, user } = useUser();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const fullName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Current account";

  return (
    <>
      <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-fresco-title">Session</h2>
          <p className="text-sm leading-6 text-fresco-description">
            {isLoaded && user?.primaryEmailAddress?.emailAddress
              ? `Signed in as ${fullName} (${user.primaryEmailAddress.emailAddress}).`
              : "Manage your current dashboard session."}
          </p>
        </div>

        <div>
          <Button
            className="gap-2"
            onClick={() => setConfirmLogoutOpen(true)}
            type="button"
            variant="outline"
          >
            <SignOutIcon className="size-4" />
            <span>Log out</span>
          </Button>
        </div>
      </section>

      <Dialog onOpenChange={setConfirmLogoutOpen} open={confirmLogoutOpen}>
        <DialogContent className="border-fresco-divider bg-fresco-panel text-fresco-title border" showCloseButton={false}>
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
