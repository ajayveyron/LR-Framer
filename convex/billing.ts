import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Usage Records
// ---------------------------------------------------------------------------

export const insertUsageRecord = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    featureType: v.union(
      v.literal("chat"),
      v.literal("image"),
      v.literal("image_tool"),
      v.literal("rewrite"),
    ),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    model: v.string(),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("aiUsageRecords", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getOrgUsageForPeriod = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_org_period", (q: any) =>
        q
          .eq("clerkOrganizationId", args.clerkOrganizationId)
          .gte("createdAt", args.periodStart)
          .lt("createdAt", args.periodEnd),
      )
      .collect();

    let total = 0;
    for (const r of records) {
      total += r.totalTokens;
    }
    return total;
  },
});

export const getOrgUsageByFeature = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_org_period", (q: any) =>
        q
          .eq("clerkOrganizationId", args.clerkOrganizationId)
          .gte("createdAt", args.periodStart)
          .lt("createdAt", args.periodEnd),
      )
      .collect();

    const byFeature: Record<string, number> = {
      chat: 0,
      image: 0,
      image_tool: 0,
      rewrite: 0,
    };
    for (const r of records) {
      byFeature[r.featureType] = (byFeature[r.featureType] ?? 0) + r.totalTokens;
    }
    return byFeature;
  },
});

export const getOrgUsageByUser = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_org_period", (q: any) =>
        q
          .eq("clerkOrganizationId", args.clerkOrganizationId)
          .gte("createdAt", args.periodStart)
          .lt("createdAt", args.periodEnd),
      )
      .collect();

    const byUser: Record<string, number> = {};
    for (const r of records) {
      byUser[r.clerkUserId] = (byUser[r.clerkUserId] ?? 0) + r.totalTokens;
    }
    return Object.entries(byUser).map(([userId, totalTokens]) => ({
      userId,
      totalTokens,
    }));
  },
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export const upsertSubscription = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    dodoSubscriptionId: v.string(),
    dodoCustomerId: v.string(),
    planId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("past_due"),
    ),
    monthlyTokenAllowance: v.number(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q: any) =>
        q.eq("clerkOrganizationId", args.clerkOrganizationId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        dodoSubscriptionId: args.dodoSubscriptionId,
        dodoCustomerId: args.dodoCustomerId,
        planId: args.planId,
        status: args.status,
        monthlyTokenAllowance: args.monthlyTokenAllowance,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("subscriptions", {
      ...args,
      updatedAt: now,
    });
  },
});

export const getSubscriptionByOrg = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q: any) =>
        q.eq("clerkOrganizationId", args.clerkOrganizationId),
      )
      .unique();
  },
});

export const getSubscriptionByDodoId = queryGeneric({
  args: {
    dodoSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("subscriptions")
      .withIndex("by_dodo_subscription", (q: any) =>
        q.eq("dodoSubscriptionId", args.dodoSubscriptionId),
      )
      .unique();
  },
});

// ---------------------------------------------------------------------------
// Framer Project Claims
// ---------------------------------------------------------------------------

export const claimFramerProject = mutationGeneric({
  args: {
    framerProjectId: v.string(),
    clerkOrganizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Atomically check uniqueness before inserting
    const existing = await ctx.db
      .query("framerProjectClaims")
      .withIndex("by_project", (q: any) =>
        q.eq("framerProjectId", args.framerProjectId),
      )
      .unique();

    if (existing) {
      if (existing.clerkOrganizationId === args.clerkOrganizationId) {
        // Same org re-claiming — idempotent, return existing
        return { claimed: true, id: existing._id };
      }
      // Already claimed by another org
      return { claimed: false, claimedByOrg: existing.clerkOrganizationId };
    }

    const id = await ctx.db.insert("framerProjectClaims", {
      framerProjectId: args.framerProjectId,
      clerkOrganizationId: args.clerkOrganizationId,
      claimedAt: Date.now(),
    });
    return { claimed: true, id };
  },
});

export const releaseFramerProject = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("framerProjectClaims")
      .withIndex("by_org", (q: any) =>
        q.eq("clerkOrganizationId", args.clerkOrganizationId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getFramerProjectClaim = queryGeneric({
  args: {
    framerProjectId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("framerProjectClaims")
      .withIndex("by_project", (q: any) =>
        q.eq("framerProjectId", args.framerProjectId),
      )
      .unique();
  },
});

export const listActiveSubscriptions = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("subscriptions").collect();
    return all.filter((s: any) => s.status === "active");
  },
});
