# Implementation Plan: AI Usage Billing

## Overview

Implement token-based AI usage billing and metering for FramerLink. The plan builds incrementally: centralized plan config → Convex schema → token tracking → quota enforcement → Dodo Payments integration → usage API → UI components → Framer project uniqueness. Each step wires into the previous one so there's no orphaned code.

## Tasks

- [x] 1. Set up plan configuration and core billing module
  - [x] 1.1 Create `src/lib/billing.ts` with `PLAN_CONFIG`, `getPlanById`, `FALLBACK_IMAGE_TOKEN_COST`, and billing cycle helpers
    - Export `PLAN_CONFIG` constant with `free` and `pro` plans (id, name, priceMonthly, monthlyTokenAllowance, dodoProductId)
    - Export `getPlanById(planId: string)` that returns the plan or `undefined`
    - Export `FALLBACK_IMAGE_TOKEN_COST` constant (e.g., 1000)
    - Export `getBillingCycleDates(subscription?)` that returns `{ cycleStart, cycleEnd }` — uses subscription period dates if available, falls back to calendar-month boundaries
    - Export `calculateUsagePercent(currentUsage, allowance)` returning `Math.min(100, Math.round((currentUsage / allowance) * 100))`
    - Export `getMeterState(percent)` returning `"normal"` | `"warning"` | `"exhausted"` based on thresholds (80, 100)
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 2.2, 2.3, 6.2, 6.3_

  - [ ]* 1.2 Write property test: Plan config lookup (Property 12)
    - **Property 12: Plan config lookup**
    - Generate random plan IDs (mix of "free", "pro", and arbitrary strings), verify `getPlanById` returns correct plan for known IDs and `undefined` for unknown
    - **Validates: Requirements 11.3**

  - [ ]* 1.3 Write property test: Usage percentage calculation (Property 4)
    - **Property 4: Usage percentage calculation**
    - Generate random non-negative usage and positive allowance values, verify `calculateUsagePercent` matches `Math.min(100, Math.round((usage / allowance) * 100))` and result is always 0–100
    - **Validates: Requirements 2.3**

  - [ ]* 1.4 Write property test: Billing cycle date calculation (Property 3)
    - **Property 3: Billing cycle date calculation**
    - Generate random subscription period dates and timestamps within range, verify `getBillingCycleDates` returns correct boundaries; for no-subscription case, verify calendar-month boundaries
    - **Validates: Requirements 2.2**

  - [ ]* 1.5 Write property test: Usage meter state derivation (Property 11)
    - **Property 11: Usage meter state derivation**
    - Generate random percentages 0–200, verify `getMeterState` returns "normal" for <80, "warning" for 80–99, "exhausted" for >=100
    - **Validates: Requirements 6.2, 6.3**

- [ ] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add Convex schema and mutation/query functions for billing tables
  - [x] 3.1 Add `aiUsageRecords`, `subscriptions`, and `framerProjectClaims` tables to `convex/schema.ts`
    - Add `aiUsageRecords` table with fields: clerkOrganizationId, clerkUserId, featureType (union of "chat"/"image"/"image_tool"/"rewrite"), promptTokens, completionTokens, totalTokens, model, conversationId (optional), createdAt — with indexes `by_org_period` and `by_org_user_period`
    - Add `subscriptions` table with fields: clerkOrganizationId, dodoSubscriptionId, dodoCustomerId, planId, status (union of "active"/"cancelled"/"expired"/"past_due"), monthlyTokenAllowance, currentPeriodStart, currentPeriodEnd, updatedAt — with indexes `by_org` and `by_dodo_subscription`
    - Add `framerProjectClaims` table with fields: framerProjectId, clerkOrganizationId, claimedAt — with indexes `by_project` and `by_org`
    - _Requirements: 1.5, 4.8, 12.1_

  - [x] 3.2 Create `convex/billing.ts` with Convex mutation/query functions
    - `insertUsageRecord` mutation — inserts a record into `aiUsageRecords`
    - `getOrgUsageForPeriod` query — aggregates totalTokens for an org between start/end timestamps
    - `getOrgUsageByFeature` query — groups usage by featureType for an org in a period
    - `getOrgUsageByUser` query — groups usage by userId for an org in a period
    - `upsertSubscription` mutation — upserts subscription record by org (enforces one-per-org)
    - `getSubscriptionByOrg` query — returns subscription for an org
    - `getSubscriptionByDodoId` query — returns subscription by dodoSubscriptionId
    - `claimFramerProject` mutation — atomically claims a project ID for an org (checks uniqueness first)
    - `releaseFramerProject` mutation — removes claim for an org
    - `getFramerProjectClaim` query — checks if a project ID is already claimed
    - Follow existing patterns from `convex/product.ts` (use `queryGeneric`/`mutationGeneric`, `v` validators)
    - _Requirements: 1.5, 2.1, 2.4, 2.5, 4.8, 4.9, 12.1, 12.3, 12.4_

- [-] 4. Implement token tracking in AI routes
  - [x] 4.1 Add `trackTokenUsage` function to `src/lib/billing.ts`
    - Accepts params: organizationId, userId, featureType, promptTokens, completionTokens, totalTokens, model, conversationId (optional)
    - Calls `insertUsageRecord` Convex mutation via `fetchProductMutation`
    - Logs wide event `billing.usage.recorded` on success
    - On failure: logs wide event error `billing.usage.record_failed` and swallows the exception (non-blocking)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 10.1_

  - [ ] 4.2 Integrate `trackTokenUsage` into `/api/ai/chat/route.ts`
    - In the `onFinish` callback, call `trackTokenUsage` with featureType "chat", usage from `usage.promptTokens`/`usage.completionTokens`, and the org/user IDs from Clerk auth
    - Include all tool-call-related tokens in the total (Vercel AI SDK aggregates these in `usage` automatically)
    - _Requirements: 1.1, 1.4, 1.7_

  - [ ] 4.3 Integrate `trackTokenUsage` into `/api/ai/image/route.ts`
    - After successful image generation, call `trackTokenUsage` with featureType "image"
    - Use `result.usage.promptTokens`/`result.usage.completionTokens` if available, otherwise apply `FALLBACK_IMAGE_TOKEN_COST`
    - _Requirements: 1.2, 9.1, 9.2, 9.3_

  - [ ] 4.4 Integrate `trackTokenUsage` into `/api/ai/rewrite/route.ts`
    - After successful rewrite, call `trackTokenUsage` with featureType "rewrite" using `result.usage`
    - _Requirements: 1.1, 1.7_

  - [ ] 4.5 Integrate `trackTokenUsage` for `generate_and_upload_image` tool in `src/lib/ai-image-tool.ts`
    - After the tool's image generation completes, call `trackTokenUsage` with featureType "image_tool" as a separate record from the parent chat session
    - _Requirements: 1.3_

  - [ ]* 4.6 Write property test: Usage recording round trip (Property 1)
    - **Property 1: Usage recording round trip**
    - Generate random valid usage params (orgId, userId, featureType, token counts, model, optional conversationId), call `trackTokenUsage` with a mock Convex client, verify the mutation was called with matching fields
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 9.1, 9.2**

- [x] 5. Implement quota enforcement
  - [x] 5.1 Add `checkQuota` function to `src/lib/billing.ts`
    - Queries the org's subscription via `getSubscriptionByOrg`
    - If no subscription, uses `PLAN_CONFIG.free` allowance and calendar-month cycle
    - Aggregates org usage for the current billing cycle via `getOrgUsageForPeriod`
    - Returns `{ allowed, currentUsage, allowance, percentUsed }`
    - `allowed = currentUsage < allowance` (soft cap)
    - Logs wide event `billing.quota.checked` with org ID, usage, allowance, and result
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 10.2_

  - [x] 5.2 Add quota gating to all AI routes (`/api/ai/chat`, `/api/ai/image`, `/api/ai/rewrite`)
    - Before processing, call `checkQuota(organizationId)`
    - If `allowed === false`, return 429 with message "Your organization's AI allowance has been exhausted this month"
    - Log wide event `billing.quota.rejected` on rejection
    - If quota check itself fails (Convex error), log error and allow request to proceed (fail-open)
    - _Requirements: 3.1, 3.2, 3.4, 10.2_

  - [ ]* 5.3 Write property test: Quota check correctness (Property 6)
    - **Property 6: Quota check correctness**
    - Generate random usage/allowance pairs, verify `allowed === (currentUsage < allowance)` regardless of user distribution
    - **Validates: Requirements 3.1, 3.2, 3.5**

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 7. Implement Dodo Payments webhook handler
  - [x] 7.1 Add Dodo billing env vars to `src/lib/env.ts`
    - Add optional `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PRO_PRODUCT_ID`, `DODO_BUSINESS_ID` to env validation
    - Export `getDodoBillingEnv()` that returns the validated vars or `undefined` (graceful degradation)
    - Export `getDodoBillingEnvIssues()` for diagnostics
    - Follow existing pattern from `getAIEnv()` / `getAIEnvIssues()`
    - _Requirements: 4.1_

  - [x] 7.2 Add webhook signature verification utility to `src/lib/billing.ts`
    - Export `verifyDodoWebhookSignature(payload, signature, secret)` using HMAC-SHA256
    - Returns `true` if valid, `false` otherwise
    - _Requirements: 4.6, 8.1_

  - [x] 7.3 Create `src/app/api/billing/webhook/route.ts`
    - Validate webhook signature; return 401 + log warning on failure
    - Parse event type from payload
    - Handle `subscription.active`: resolve plan from `PLAN_CONFIG`, upsert subscription with correct allowance
    - Handle `subscription.cancelled` / `subscription.expired`: set status, set allowance to 0
    - Handle `subscription.updated`: resolve new plan from `PLAN_CONFIG`, update allowance
    - Reject unknown plan IDs: log error, return 200, do NOT update subscription
    - Unknown organization: log warning, return 200
    - Idempotent — re-processing same event produces same state
    - Log wide event for every webhook received
    - Respond with 200 within 5 seconds
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 8.1, 8.2, 8.3, 8.4, 8.5, 10.3, 10.4, 11.4, 11.5_

  - [ ]* 7.4 Write property test: Webhook signature validation (Property 10)
    - **Property 10: Webhook signature validation**
    - Generate random payloads and secrets, compute valid HMAC signatures, verify acceptance; mutate payload or signature bytes and verify rejection
    - **Validates: Requirements 8.1**

  - [ ]* 7.5 Write property test: Webhook subscription state update (Property 7)
    - **Property 7: Webhook subscription state update**
    - Generate random webhook payloads with valid plan IDs from PLAN_CONFIG, verify resulting subscription's `monthlyTokenAllowance` matches the plan; for cancel/expire events verify allowance is 0
    - **Validates: Requirements 4.3, 4.4, 4.5, 11.4**

  - [ ]* 7.6 Write property test: Webhook idempotence (Property 8)
    - **Property 8: Webhook idempotence**
    - Generate random valid webhook events, process N times (N >= 1), verify subscription state equals single-processing state
    - **Validates: Requirements 4.7**

  - [ ]* 7.7 Write property test: One subscription per Organization (Property 9)
    - **Property 9: One subscription per Organization**
    - Generate random sequences of webhook events for one org, verify at most one subscription record exists after processing all events
    - **Validates: Requirements 4.9**

- [x] 8. Implement checkout and portal routes
  - [x] 8.1 Create `src/app/api/billing/checkout/route.ts`
    - POST route requiring Clerk auth + admin role
    - Creates a Dodo Payments checkout session for the Pro plan using `PLAN_CONFIG.pro.dodoProductId`
    - Associates subscription with the user's Organization
    - Returns the checkout URL for client-side redirect
    - Log wide events for success/failure
    - _Requirements: 4.1, 4.2, 7.3_

  - [x] 8.2 Create `src/app/api/billing/portal/route.ts`
    - POST route requiring Clerk auth + admin role
    - Creates a Dodo Payments customer portal session for the org's existing subscription
    - Returns the portal URL for client-side redirect
    - Log wide events for success/failure
    - _Requirements: 7.2_

- [x] 9. Implement usage query API route
  - [x] 9.1 Create `src/app/api/billing/usage/route.ts`
    - GET route requiring Clerk auth
    - Queries org subscription, determines billing cycle dates
    - Aggregates org usage for current cycle (total, by feature, by user)
    - Returns `{ percentUsed, currentUsage, allowance, planName, byFeature, byUser, cycleStart, cycleEnd }`
    - When no subscription exists, uses Free plan allowance from `PLAN_CONFIG`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 9.2 Write property test: Organization-level usage aggregation (Property 2)
    - **Property 2: Organization-level usage aggregation**
    - Generate random sets of usage records for multiple users in one org, verify aggregate equals sum of all `totalTokens`
    - **Validates: Requirements 2.1**

  - [ ]* 9.3 Write property test: Usage breakdowns sum to total (Property 5)
    - **Property 5: Usage breakdowns sum to total**
    - Generate random records with mixed feature types and users, verify per-feature breakdown sums to total and per-user breakdown sums to total
    - **Validates: Requirements 2.4, 2.5**

- [ ] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Build Usage Meter and Subscription Management UI
  - [x] 11.1 Create `src/components/usage-meter.tsx`
    - Client component that fetches `GET /api/billing/usage` on mount
    - Displays percentage progress bar using shadcn/ui `Progress` component
    - Friendly copy: "Your team has used X% of this month's AI allowance"
    - Warning state (amber styling) at >80%
    - Exhausted state (red styling) at 100%
    - When no subscription: show "Subscribe to Pro" CTA linking to checkout
    - Use phosphor icons for visual indicators
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 11.2 Add subscription management section and usage meter to `src/app/dashboard/settings/page.tsx`
    - Display current plan name, status, renewal date, and monthly allowance
    - "Manage Subscription" button → calls `/api/billing/portal` and redirects
    - "Subscribe" button (when no active subscription) → calls `/api/billing/checkout` and redirects
    - Admin-only: hide subscription management actions for non-admin users (use existing `isAdmin` check)
    - Non-admin users see the usage meter but not management controls
    - Render `<UsageMeter />` component in the settings page
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 11.3 Write property test: Admin-only subscription management (Property 15)
    - **Property 15: Admin-only subscription management**
    - Generate random user roles, verify subscription management actions are visible if and only if role is "admin"
    - **Validates: Requirements 7.4, 7.5**

- [x] 12. Implement Framer project uniqueness enforcement
  - [x] 12.1 Add Framer project claim check to `/api/onboarding/complete/route.ts`
    - Before saving site setup, query `framerProjectClaims` to check if the project ID is already claimed by another org
    - If claimed: reject with 409 and descriptive error, log wide event `billing.framer_claim.rejected`
    - If available: atomically insert the claim via `claimFramerProject` mutation
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_

  - [x] 12.2 Add Framer project claim release logic
    - When an org disconnects/switches projects (in the site setup update flow), release the old claim via `releaseFramerProject` mutation
    - _Requirements: 12.4_

  - [ ]* 12.3 Write property test: Framer project uniqueness (Property 13)
    - **Property 13: Framer project uniqueness**
    - Generate random project IDs and two distinct org IDs, verify first claim succeeds and second is rejected; project is associated with exactly one org
    - **Validates: Requirements 12.1, 12.2, 12.3**

  - [ ]* 12.4 Write property test: Framer project claim-release round trip (Property 14)
    - **Property 14: Framer project claim-release round trip**
    - Generate random project/org pairs, claim then release, verify another org can then claim successfully
    - **Validates: Requirements 12.4**

- [x] 13. Implement metered usage reporting to Dodo Payments
  - [x] 13.1 Add `reportMeteredUsage` function to `src/lib/billing.ts`
    - Sends aggregated org-level token usage to Dodo Payments metered billing API
    - Retries with exponential backoff (max 3 attempts) on failure
    - Logs wide event `billing.metered_report.sent` on success
    - Logs wide event error `billing.metered_report.failed` on each failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 13.2 Create `src/app/api/billing/report-usage/route.ts`
    - POST route (callable by cron or internal trigger)
    - Iterates active subscriptions and reports metered usage for each org's billing period
    - _Requirements: 5.1, 5.2_

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementation tasks use TypeScript
- Follow existing codebase patterns: wide event logging via `logEvent`/`logError`, Convex `queryGeneric`/`mutationGeneric`, Clerk auth, `fetchProductMutation`/`fetchProductQuery` with `anyApi`
