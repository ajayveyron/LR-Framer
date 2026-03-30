import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up old processed webhook records (older than 30 days)
crons.weekly(
  "cleanup:processedWebhooks",
  { hourUTC: 3, minuteUTC: 0, dayOfWeek: "sunday" },
  internal.cleanup.deleteOldProcessedWebhooks,
);

// Clean up old AI usage records (older than 90 days)
crons.weekly(
  "cleanup:aiUsageRecords",
  { hourUTC: 3, minuteUTC: 30, dayOfWeek: "sunday" },
  internal.cleanup.deleteOldAiUsageRecords,
);

// Clean up old chat conversations (older than 90 days, not updated)
crons.weekly(
  "cleanup:chatConversations",
  { hourUTC: 4, minuteUTC: 0, dayOfWeek: "sunday" },
  internal.cleanup.deleteOldChatConversations,
);

export default crons;
