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
    clerkOrganizationId: v.string(),
    slug: v.optional(v.string()),
    draft: v.optional(v.boolean()),
    fieldDataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, clerkOrganizationId, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Staged item not found");
    if (existing.clerkOrganizationId !== clerkOrganizationId) {
      throw new Error("Staged item not found");
    }
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
    return id;
  },
});

export const setFieldValue = mutationGeneric({
  args: {
    id: v.id("stagedItems"),
    clerkOrganizationId: v.optional(v.string()),
    fieldId: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Staged item not found");
    // When clerkOrganizationId is provided, enforce ownership.
    // TODO: Make this required once all callers pass org ID.
    if (args.clerkOrganizationId && existing.clerkOrganizationId !== args.clerkOrganizationId) {
      throw new Error("Staged item not found");
    }

    let fieldValues: Record<string, unknown> = {};
    try {
      fieldValues = JSON.parse(existing.fieldDataJson) as Record<string, unknown>;
    } catch {
      fieldValues = {};
    }

    if (args.value == null) {
      delete fieldValues[args.fieldId];
    } else {
      fieldValues[args.fieldId] = args.value;
    }

    await ctx.db.patch(args.id, {
      fieldDataJson: JSON.stringify(fieldValues),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

export const remove = mutationGeneric({
  args: {
    id: v.id("stagedItems"),
    clerkOrganizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    if (existing.clerkOrganizationId !== args.clerkOrganizationId) {
      return null;
    }
    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const removeBatch = mutationGeneric({
  args: {
    ids: v.array(v.id("stagedItems")),
    clerkOrganizationId: v.string(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const existing = await ctx.db.get(id);
      if (existing && existing.clerkOrganizationId === args.clerkOrganizationId) {
        await ctx.db.delete(id);
      }
    }
    return args.ids;
  },
});
