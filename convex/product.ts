import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

async function getSiteByOrganizationId(db: any, clerkOrganizationId: string) {
  return db
    .query("sites")
    .withIndex("by_org", (query: any) =>
      query.eq("clerkOrganizationId", clerkOrganizationId)
    )
    .unique();
}

async function getMembershipByOrganizationAndUser(
  db: any,
  clerkOrganizationId: string,
  clerkUserId: string,
) {
  return db
    .query("memberships")
    .withIndex("by_org_user", (query: any) =>
      query
        .eq("clerkOrganizationId", clerkOrganizationId)
        .eq("clerkUserId", clerkUserId)
    )
    .unique();
}

async function getOnboardingStateByOrganizationAndUser(
  db: any,
  clerkOrganizationId: string,
  clerkUserId: string,
) {
  return db
    .query("onboardingStates")
    .withIndex("by_org_user", (query: any) =>
      query
        .eq("clerkOrganizationId", clerkOrganizationId)
        .eq("clerkUserId", clerkUserId)
    )
    .unique();
}

export const getSiteForOrganization = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return getSiteByOrganizationId(ctx.db, args.clerkOrganizationId);
  },
});

export const getOnboardingState = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return getOnboardingStateByOrganizationAndUser(
      ctx.db,
      args.clerkOrganizationId,
      args.clerkUserId,
    );
  },
});

export const upsertMembership = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    role: v.union(v.literal("admin"), v.literal("contributor")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await getMembershipByOrganizationAndUser(
      ctx.db,
      args.clerkOrganizationId,
      args.clerkUserId,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("memberships", {
      clerkOrganizationId: args.clerkOrganizationId,
      clerkUserId: args.clerkUserId,
      createdAt: now,
      role: args.role,
      updatedAt: now,
    });
  },
});

export const saveValidatedFramerDraft = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    collectionId: v.optional(v.string()),
    collectionName: v.optional(v.string()),
    projectId: v.string(),
    projectUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await getOnboardingStateByOrganizationAndUser(
      ctx.db,
      args.clerkOrganizationId,
      args.clerkUserId,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        collectionId: args.collectionId,
        collectionName: args.collectionName,
        projectId: args.projectId,
        projectUrl: args.projectUrl,
        step: "framer",
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("onboardingStates", {
      clerkOrganizationId: args.clerkOrganizationId,
      clerkUserId: args.clerkUserId,
      collectionId: args.collectionId,
      collectionName: args.collectionName,
      createdAt: now,
      projectId: args.projectId,
      projectUrl: args.projectUrl,
      step: "framer",
      updatedAt: now,
    });
  },
});

export const saveSiteSetup = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    encryptedFramerApiKey: v.string(),
    framerCollectionId: v.string(),
    framerCollectionName: v.string(),
    framerMetadataJson: v.string(),
    framerProjectId: v.string(),
    framerProjectUrl: v.string(),
    siteName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingSite = await getSiteByOrganizationId(
      ctx.db,
      args.clerkOrganizationId,
    );

    if (existingSite) {
      await ctx.db.patch(existingSite._id, {
        framerApiKeyCiphertext: args.encryptedFramerApiKey,
        framerCollectionId: args.framerCollectionId,
        framerCollectionName: args.framerCollectionName,
        framerMetadataJson: args.framerMetadataJson,
        framerProjectId: args.framerProjectId,
        framerProjectUrl: args.framerProjectUrl,
        name: args.siteName,
        onboardingStatus: "ready",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("sites", {
        clerkOrganizationId: args.clerkOrganizationId,
        createdAt: now,
        createdByUserId: args.clerkUserId,
        framerApiKeyCiphertext: args.encryptedFramerApiKey,
        framerCollectionId: args.framerCollectionId,
        framerCollectionName: args.framerCollectionName,
        framerMetadataJson: args.framerMetadataJson,
        framerProjectId: args.framerProjectId,
        framerProjectUrl: args.framerProjectUrl,
        name: args.siteName,
        onboardingStatus: "ready",
        updatedAt: now,
      });
    }

    const onboardingState = await getOnboardingStateByOrganizationAndUser(
      ctx.db,
      args.clerkOrganizationId,
      args.clerkUserId,
    );

    if (onboardingState) {
      await ctx.db.patch(onboardingState._id, {
        collectionId: args.framerCollectionId,
        collectionName: args.framerCollectionName,
        projectId: args.framerProjectId,
        projectUrl: args.framerProjectUrl,
        step: "complete",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("onboardingStates", {
        clerkOrganizationId: args.clerkOrganizationId,
        clerkUserId: args.clerkUserId,
        collectionId: args.framerCollectionId,
        collectionName: args.framerCollectionName,
        createdAt: now,
        projectId: args.framerProjectId,
        projectUrl: args.framerProjectUrl,
        step: "complete",
        updatedAt: now,
      });
    }
  },
});
