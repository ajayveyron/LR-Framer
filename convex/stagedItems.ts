import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const listByCollection = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
    collectionId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("stagedItems")
      .withIndex("by_org_collection", (q: any) =>
        q
          .eq("clerkOrganizationId", args.clerkOrganizationId)
          .eq("collectionId", args.collectionId),
      )
      .collect();
  },
});

export const create = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    collectionId: v.string(),
    slug: v.string(),
    draft: v.boolean(),
    fieldDataJson: v.string(),
    createdByUserId: v.string(),
    source: v.union(v.literal("ai"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("stagedItems", {
      clerkOrganizationId: args.clerkOrganizationId,
      collectionId: args.collectionId,
      slug: args.slug,
      draft: args.draft,
      fieldDataJson: args.fieldDataJson,
      createdByUserId: args.createdByUserId,
      source: args.source,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutationGeneric({
  args: {
    id: v.id("stagedItems"),
    slug: v.optional(v.string()),
    draft: v.optional(v.boolean()),
    fieldDataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Staged item not found");
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
    return id;
  },
});

export const remove = mutationGeneric({
  args: { id: v.id("stagedItems") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const removeBatch = mutationGeneric({
  args: {
    ids: v.array(v.id("stagedItems")),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const existing = await ctx.db.get(id);
      if (existing) await ctx.db.delete(id);
    }
    return args.ids;
  },
});
