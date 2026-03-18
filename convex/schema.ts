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
