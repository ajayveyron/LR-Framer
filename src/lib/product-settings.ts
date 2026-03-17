import "server-only";

import { auth } from "@clerk/nextjs/server";
import { anyApi } from "convex/server";

import { fetchProductQuery } from "@/lib/convex";
import { decryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { getProductEnvIssues } from "@/lib/product-env";
import type { ProductSite } from "@/lib/product-types";

export async function requireSiteSettingsAdminAccess() {
  const issues = getProductEnvIssues();
  if (issues.length > 0) {
    throw new AppError(
      "FramerLink is missing required product environment variables.",
      503,
      { fieldErrors: issues },
    );
  }

  const { orgId, orgRole, userId } = await auth();
  if (!userId) {
    throw new AppError("Sign in to manage team settings.", 401);
  }

  if (!orgId) {
    throw new AppError("Create your team before updating settings.", 400);
  }

  if (orgRole !== "org:admin") {
    throw new AppError("Only admins can update the Framer connection.", 403);
  }

  const site = (await fetchProductQuery(anyApi.product.getSiteForOrganization, {
    clerkOrganizationId: orgId,
  })) as ProductSite | null;

  if (!site || site.onboardingStatus !== "ready") {
    throw new AppError("Finish onboarding before changing team settings.", 400);
  }

  return {
    orgId,
    site,
    userId,
  };
}

export function resolveSubmittedOrStoredApiKey(
  site: ProductSite,
  submittedApiKey: string | undefined,
) {
  const trimmedApiKey = submittedApiKey?.trim();
  if (trimmedApiKey) {
    return trimmedApiKey;
  }

  if (!site.framerApiKeyCiphertext) {
    throw new AppError("Enter a Framer API key to continue.", 400);
  }

  return decryptSecret(site.framerApiKeyCiphertext);
}
