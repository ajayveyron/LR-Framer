import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const MAX_CONVERSATIONS = 50;

export const listConversations = queryGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("chatConversations")
      .withIndex("by_org_user", (q: any) =>
        q
          .eq("clerkOrganizationId", args.clerkOrganizationId)
          .eq("clerkUserId", args.clerkUserId),
      )
      .collect();

    // Sort by updatedAt desc, take top N
    rows.sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    return rows.slice(0, MAX_CONVERSATIONS).map((r: any) => ({
      conversationId: r.conversationId,
      createdAt: r.createdAt,
      messages: r.messages,
      title: r.title,
      updatedAt: r.updatedAt,
    }));
  },
});

export const saveConversation = mutationGeneric({
  args: {
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    conversationId: v.string(),
    messages: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("chatConversations")
      .withIndex("by_conversation", (q: any) =>
        q.eq("conversationId", args.conversationId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        messages: args.messages,
        title: args.title,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("chatConversations", {
      clerkOrganizationId: args.clerkOrganizationId,
      clerkUserId: args.clerkUserId,
      conversationId: args.conversationId,
      createdAt: now,
      messages: args.messages,
      title: args.title,
      updatedAt: now,
    });
  },
});

export const deleteConversation = mutationGeneric({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chatConversations")
      .withIndex("by_conversation", (q: any) =>
        q.eq("conversationId", args.conversationId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
