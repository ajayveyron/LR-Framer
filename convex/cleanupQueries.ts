import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getOldProcessedWebhooks = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const rows = await ctx.db
      .query("processedWebhooks")
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .take(limit);
    return rows.map((r) => r._id);
  },
});

export const getOldAiUsageRecords = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const rows = await ctx.db
      .query("aiUsageRecords")
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .take(limit);
    return rows.map((r) => r._id);
  },
});

export const getOldChatConversations = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const rows = await ctx.db
      .query("chatConversations")
      .filter((q) => q.lt(q.field("updatedAt"), cutoff))
      .take(limit);
    return rows.map((r) => r._id);
  },
});

export const deleteById = internalMutation({
  args: { tableName: v.string(), id: v.any() },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
