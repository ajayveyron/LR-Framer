import { cache } from "react";

import { auth, currentUser } from "@clerk/nextjs/server";
import { anyApi } from "convex/server";
import { redirect } from "next/navigation";

import { decryptSecret } from "@/lib/crypto";
import { fetchProductMutation, fetchProductQuery } from "@/lib/convex";
import type { FramerRuntimeContext } from "@/lib/framer-runtime";
import { logError } from "@/lib/logger";
import { getProductEnvIssues } from "@/lib/product-env";
import type {
  ProductOnboardingState,
  ProductSite,
  SiteRole,
} from "@/lib/product-types";

type ConfigErrorState = {
  issues: Array<{ path: string; message: string }>;
  kind: "config_error";
};

type OnboardingAccessState = {
  kind: "ready";
  onboardingState: ProductOnboardingState | null;
  organizationId: string | null;
  role: SiteRole | null;
  site: ProductSite | null;
  suggestedSiteName: string;
  userId: string;
};

type DashboardAccessState = {
  kind: "ready";
  organizationId: string;
  role: SiteRole;
  site: ProductSite;
  userId: string;
};

function mapOrganizationRole(role: string | null | undefined): SiteRole | null {
  if (role === "org:admin") {
    return "admin";
  }

  if (role === "org:member") {
    return "contributor";
  }

  return null;
}

async function syncMembership(
  organizationId: string,
  userId: string,
  role: SiteRole | null,
) {
  if (!role) {
    return;
  }

  try {
    await fetchProductMutation(anyApi.product.upsertMembership, {
      clerkOrganizationId: organizationId,
      clerkUserId: userId,
      role,
    });
  } catch (error) {
    logError("product.access.syncMembership.failed", error, {
      clerkOrganizationId: organizationId,
      clerkUserId: userId,
      role,
    });
  }
}

async function getSiteForOrganization(organizationId: string) {
  try {
    return (await fetchProductQuery(anyApi.product.getSiteForOrganization, {
      clerkOrganizationId: organizationId,
    })) as ProductSite | null;
  } catch (error) {
    logError("product.access.getSiteForOrganization.failed", error, {
      clerkOrganizationId: organizationId,
    });
    return null;
  }
}

async function getOnboardingState(
  organizationId: string,
  userId: string,
) {
  try {
    return (await fetchProductQuery(anyApi.product.getOnboardingState, {
      clerkOrganizationId: organizationId,
      clerkUserId: userId,
    })) as ProductOnboardingState | null;
  } catch (error) {
    logError("product.access.getOnboardingState.failed", error, {
      clerkOrganizationId: organizationId,
      clerkUserId: userId,
    });
    return null;
  }
}

function getSuggestedSiteName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) {
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length > 0) {
    return `${parts.join(" ")} Team`;
  }

  return "My FramerLink Team";
}

async function getSafeCurrentUser() {
  try {
    return await currentUser();
  } catch (error) {
    logError("product.access.currentUser.failed", error);
    return null;
  }
}

export const getOnboardingAccess = cache(
  async (): Promise<ConfigErrorState | OnboardingAccessState> => {
    const issues = getProductEnvIssues();
    if (issues.length > 0) {
      return {
        issues,
        kind: "config_error",
      };
    }

    const { orgId, orgRole, userId } = await auth();
    if (!userId) {
      redirect("/sign-in");
    }

    const user = await getSafeCurrentUser();
    const role = mapOrganizationRole(orgRole);
    const site = orgId ? await getSiteForOrganization(orgId) : null;
    const onboardingState = orgId
      ? await getOnboardingState(orgId, userId)
      : null;

    if (orgId) {
      await syncMembership(orgId, userId, role);
    }

    if (
      site?.onboardingStatus === "ready" &&
      site.framerApiKeyCiphertext &&
      site.framerProjectId &&
      site.framerCollectionId &&
      site.framerCollectionName
    ) {
      redirect("/dashboard");
    }

    return {
      kind: "ready",
      onboardingState,
      organizationId: orgId ?? null,
      role,
      site,
      suggestedSiteName: getSuggestedSiteName(user?.firstName, user?.lastName),
      userId,
    };
  },
);

export const getDashboardAccess = cache(
  async (): Promise<ConfigErrorState | DashboardAccessState> => {
    const issues = getProductEnvIssues();
    if (issues.length > 0) {
      return {
        issues,
        kind: "config_error",
      };
    }

    const { orgId, orgRole, userId } = await auth();
    if (!userId) {
      redirect("/sign-in");
    }

    if (!orgId) {
      redirect("/onboarding");
    }

    const role = mapOrganizationRole(orgRole);
    await syncMembership(orgId, userId, role);

    if (!role) {
      redirect("/onboarding");
    }

    const site = await getSiteForOrganization(orgId);
    if (
      !site ||
      site.onboardingStatus !== "ready" ||
      !site.framerApiKeyCiphertext ||
      !site.framerProjectId ||
      !site.framerCollectionId ||
      !site.framerCollectionName
    ) {
      redirect("/onboarding");
    }

    return {
      kind: "ready",
      organizationId: orgId,
      role,
      site,
      userId,
    };
  },
);

export async function requireAdminAccess() {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return access;
  }

  if (access.role !== "admin") {
    redirect("/dashboard");
  }

  return access;
}

export function getSiteFramerRuntimeContext(
  site: ProductSite,
): FramerRuntimeContext {
  if (
    !site.framerApiKeyCiphertext ||
    !site.framerProjectId ||
    !site.framerCollectionId ||
    !site.framerCollectionName
  ) {
    throw new Error("The current FramerLink site is not fully configured.");
  }

  return {
    apiKey: decryptSecret(site.framerApiKeyCiphertext),
    collectionId: site.framerCollectionId,
    collectionName: site.framerCollectionName,
    projectId: site.framerProjectId,
  };
}
