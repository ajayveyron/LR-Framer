import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chatConversations: defineTable({
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    conversationId: v.string(),
    createdAt: v.number(),
    messages: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  })
    .index("by_org_user", ["clerkOrganizationId", "clerkUserId"])
    .index("by_conversation", ["conversationId"]),

  memberships: defineTable({
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    createdAt: v.number(),
    role: v.union(v.literal("admin"), v.literal("contributor")),
    updatedAt: v.number(),
  })
    .index("by_org", ["clerkOrganizationId"])
    .index("by_org_user", ["clerkOrganizationId", "clerkUserId"]),

  onboardingStates: defineTable({
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    collectionId: v.optional(v.string()),
    collectionName: v.optional(v.string()),
    createdAt: v.number(),
    projectId: v.optional(v.string()),
    projectUrl: v.optional(v.string()),
    step: v.union(
      v.literal("organization"),
      v.literal("framer"),
      v.literal("complete"),
    ),
    updatedAt: v.number(),
  })
    .index("by_org_user", ["clerkOrganizationId", "clerkUserId"])
    .index("by_user", ["clerkUserId"]),

  aiUsageRecords: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_org_period", ["clerkOrganizationId", "createdAt"])
    .index("by_org_user_period", [
      "clerkOrganizationId",
      "clerkUserId",
      "createdAt",
    ]),

  framerProjectClaims: defineTable({
    framerProjectId: v.string(),
    clerkOrganizationId: v.string(),
    claimedAt: v.number(),
  })
    .index("by_project", ["framerProjectId"])
    .index("by_org", ["clerkOrganizationId"]),

  subscriptions: defineTable({
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
    updatedAt: v.number(),
  })
    .index("by_org", ["clerkOrganizationId"])
    .index("by_dodo_subscription", ["dodoSubscriptionId"]),

  sites: defineTable({
    clerkOrganizationId: v.string(),
    createdAt: v.number(),
    createdByUserId: v.string(),
    framerApiKeyCiphertext: v.optional(v.string()),
    framerCollectionId: v.optional(v.string()),
    framerCollectionName: v.optional(v.string()),
    framerMetadataJson: v.optional(v.string()),
    framerProjectId: v.optional(v.string()),
    framerProjectUrl: v.optional(v.string()),
    name: v.string(),
    onboardingStatus: v.union(
      v.literal("not_started"),
      v.literal("framer_validated"),
      v.literal("ready"),
    ),
    updatedAt: v.number(),
  }).index("by_org", ["clerkOrganizationId"]),
});
