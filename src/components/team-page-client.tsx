"use client";

import { useEffect } from "react";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { TeamManagerPanelSkeleton } from "@/components/dashboard-page-skeletons";
import { TeamManager } from "@/components/team-manager";

export function TeamPageClient() {
  const router = useRouter();
  const { isLoaded, isSignedIn, orgId, orgRole } = useAuth();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    if (!orgId) {
      router.replace("/onboarding");
      return;
    }

    if (orgRole !== "org:admin") {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, orgId, orgRole, router]);

  if (!isLoaded || !isSignedIn || !orgId || orgRole !== "org:admin") {
    return <TeamManagerPanelSkeleton />;
  }

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid gap-6">
      <TeamManager />
    </div>
  );
}
