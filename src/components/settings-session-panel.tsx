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
      <section className="settings-section grid gap-4">
        <div className="grid gap-1">
          <h2 className="settings-heading">Session</h2>
          <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
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
