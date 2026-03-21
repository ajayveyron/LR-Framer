import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const MAX_MEMORIES_PER_USER = 50;

const categoryValidator = v.union(
  v.literal("preference"),
  v.literal("correction"),
  v.literal("workflow"),
);

export const listMemories = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("agentMemories")
      .withIndex("by_org_user", (q: any) =>
        q
          .eq("clerkOrganizationId", args.clerkOrganizationId)
          .eq("clerkUserId", args.clerkUserId),
      )
      .collect();

    rows.sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    return rows.slice(0, MAX_MEMORIES_PER_USER).map((r: any) => ({
      id: r._id,
      category: r.category,
      content: r.content,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

export const saveMemory = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    category: categoryValidator,
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for duplicate content in same category to avoid redundancy
    const existing = await ctx.db
      .query("agentMemories")
      .withIndex("by_org_user_category", (q: any) =>
        q
          .eq("clerkOrganizationId", args.clerkOrganizationId)
          .eq("clerkUserId", args.clerkUserId)
          .eq("category", args.category),
      )
      .collect();

    const duplicate = existing.find(
      (r: any) => r.content.toLowerCase() === args.content.toLowerCase(),
    );
    if (duplicate) {
      await ctx.db.patch(duplicate._id, { updatedAt: now });
      return duplicate._id;
    }

    // Enforce cap — remove oldest if at limit
    if (existing.length >= MAX_MEMORIES_PER_USER) {
      existing.sort((a: any, b: any) => a.updatedAt - b.updatedAt);
      await ctx.db.delete(existing[0]._id);
    }

    return ctx.db.insert("agentMemories", {
      clerkOrganizationId: args.clerkOrganizationId,
      clerkUserId: args.clerkUserId,
      category: args.category,
      content: args.content,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteMemory = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    memoryId: v.id("agentMemories"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.memoryId);
    if (!doc) return;

    if (
      (doc as any).clerkOrganizationId !== args.clerkOrganizationId ||
      (doc as any).clerkUserId !== args.clerkUserId
    ) {
      throw new Error("Memory does not belong to the current user.");
    }

    await ctx.db.delete(args.memoryId);
  },
});
