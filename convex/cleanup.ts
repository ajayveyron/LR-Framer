import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

export const deleteOldProcessedWebhooks = internalAction({
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    let deleted = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await ctx.runQuery(internal.cleanupQueries.getOldProcessedWebhooks, {
        cutoff,
        limit: BATCH_SIZE,
      });
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      for (const id of batch) {
        await ctx.runMutation(internal.cleanupQueries.deleteById, { tableName: "processedWebhooks", id });
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`[cleanup] Deleted ${deleted} old processedWebhooks records`);
    }
  },
});

export const deleteOldAiUsageRecords = internalAction({
  handler: async (ctx) => {
    const cutoff = Date.now() - NINETY_DAYS_MS;
    let deleted = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await ctx.runQuery(internal.cleanupQueries.getOldAiUsageRecords, {
        cutoff,
        limit: BATCH_SIZE,
      });
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      for (const id of batch) {
        await ctx.runMutation(internal.cleanupQueries.deleteById, { tableName: "aiUsageRecords", id });
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`[cleanup] Deleted ${deleted} old aiUsageRecords records`);
    }
  },
});

export const deleteOldChatConversations = internalAction({
  handler: async (ctx) => {
    const cutoff = Date.now() - NINETY_DAYS_MS;
    let deleted = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await ctx.runQuery(internal.cleanupQueries.getOldChatConversations, {
        cutoff,
        limit: BATCH_SIZE,
      });
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      for (const id of batch) {
        await ctx.runMutation(internal.cleanupQueries.deleteById, { tableName: "chatConversations", id });
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`[cleanup] Deleted ${deleted} old chatConversations records`);
    }
  },
});
