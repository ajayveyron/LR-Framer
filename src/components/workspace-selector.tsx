"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useOrganizationList, useAuth } from "@clerk/nextjs";
import {
  Buildings,
  Plus,
  CaretRight,
  Spinner as SpinnerIcon,
} from "@phosphor-icons/react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const shellClassName =
  "w-full max-w-md mx-auto flex flex-col items-center gap-8";
const cardClassName =
  "rounded-none border border-fresco-divider bg-[linear-gradient(180deg,var(--color-fresco-frame-overlay),transparent),var(--color-fresco-panel)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] w-full";

export function WorkspaceSelector() {
  const router = useRouter();
  const { orgId } = useAuth();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [activatingOrgId, setActivatingOrgId] = useState<string | null>(null);

  const memberships = useMemo(
    () => userMemberships?.data ?? [],
    [userMemberships?.data],
  );
  const doneLoading =
    isLoaded && !userMemberships?.isLoading && !!userMemberships?.data;
  const showList = doneLoading && memberships.length > 1;

  // Auto-redirect when user has 0 or 1 org — no need to show the picker.
  // We avoid setState here; the redirect itself is the side-effect.
  useEffect(() => {
    if (!doneLoading || !setActive || activatingOrgId) return;

    if (memberships.length === 0) {
      router.push("/onboarding");
    } else if (memberships.length === 1) {
      const singleOrg = memberships[0].organization;
      setActive({ organization: singleOrg.id }).then(() => {
        router.push("/dashboard");
        router.refresh();
      });
    }
  }, [doneLoading, memberships, setActive, router, activatingOrgId]);

  async function handleSelectWorkspace(organizationId: string) {
    if (!setActive || activatingOrgId) return;

    setActivatingOrgId(organizationId);
    try {
      await setActive({ organization: organizationId });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setActivatingOrgId(null);
    }
  }

  function handleCreateNew() {
    if (setActive) {
      setActive({ organization: null }).then(() => {
        router.push("/onboarding");
      });
    } else {
      router.push("/onboarding");
    }
  }

  // Show spinner while loading or auto-redirecting (0/1 org case)
  if (!showList) {
    return (
      <div className={shellClassName}>
        <BrandLogo height={32} />
        <div className={cardClassName}>
          <div className="flex flex-col items-center gap-4 py-12">
            <SpinnerIcon
              className="size-6 animate-spin text-fresco-subtitle"
              weight="bold"
            />
            <p className="text-sm text-fresco-description">
              Loading your workspaces…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <BrandLogo height={32} />

      <div className={cardClassName}>
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-fresco-text">
            Choose a workspace
          </h1>
          <p className="mt-1 text-sm text-fresco-description">
            You belong to multiple workspaces. Pick the one you want to open.
          </p>
        </div>

        <div className="grid gap-2">
          {memberships.map((membership) => {
            const org = membership.organization;
            const isActivating = activatingOrgId === org.id;
            const isCurrent = orgId === org.id;

            return (
              <button
                key={org.id}
                disabled={!!activatingOrgId}
                onClick={() => handleSelectWorkspace(org.id)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border border-fresco-divider px-4 py-3 text-left transition-colors",
                  "hover:bg-fresco-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresco-tint",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  isCurrent &&
                    !activatingOrgId &&
                    "border-fresco-tint-dimmed bg-fresco-surface-subtle",
                )}
              >
                {org.imageUrl ? (
                  <Image
                    alt={org.name}
                    className="size-9 rounded-md object-cover"
                    height={36}
                    src={org.imageUrl}
                    width={36}
                  />
                ) : (
                  <div className="flex size-9 items-center justify-center rounded-md bg-fresco-surface-muted">
                    <Buildings
                      className="size-4 text-fresco-subtitle"
                      weight="duotone"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fresco-text truncate">
                    {org.name}
                  </p>
                  <p className="text-xs text-fresco-description capitalize">
                    {membership.role.replace("org:", "")}
                  </p>
                </div>

                {isActivating ? (
                  <SpinnerIcon
                    className="size-4 animate-spin text-fresco-subtitle"
                    weight="bold"
                  />
                ) : (
                  <CaretRight
                    className="size-4 text-fresco-subtitle opacity-0 transition-opacity group-hover:opacity-100"
                    weight="bold"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-fresco-divider pt-5">
          <Button
            className="w-full gap-2"
            disabled={!!activatingOrgId}
            onClick={handleCreateNew}
            variant="outline"
          >
            <Plus className="size-4" weight="bold" />
            Create new workspace
          </Button>
        </div>
      </div>
    </div>
  );
}
