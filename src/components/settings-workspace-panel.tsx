"use client";

import { useRouter } from "next/navigation";

import { useOrganizationList, useOrganization } from "@clerk/nextjs";
import { ArrowsLeftRight } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export function SettingsWorkspacePanel() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const membershipCount = userMemberships?.data?.length ?? 0;
  if (membershipCount < 2) return null;

  return (
    <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid gap-4">
      <div className="grid gap-1">
        <h2 className="font-sans text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-fresco-title">
          Workspace
        </h2>
        <p className="text-sm leading-6 text-fresco-description">
          You&apos;re currently in{" "}
          <span className="text-fresco-text font-medium">
            {organization?.name ?? "this workspace"}
          </span>
          . You belong to {membershipCount} workspaces.
        </p>
      </div>

      <div>
        <Button
          className="gap-2"
          onClick={() => router.push("/select-workspace")}
          type="button"
          variant="outline"
        >
          <ArrowsLeftRight className="size-4" weight="bold" />
          <span>Switch workspace</span>
        </Button>
      </div>
    </section>
  );
}
