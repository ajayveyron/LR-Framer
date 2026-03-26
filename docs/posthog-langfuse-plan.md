# PostHog + Langfuse Rollout Plan

## Summary

- Use `PostHog` for product analytics across the public landing page and authenticated app.
- Use `Langfuse` for AI observability on chat, rewrite, image, and CMS-action flows.
- Do not enable session replay in the initial rollout.
- Keep both integrations optional and fail-open.
- Preserve a clean upgrade path for `Vercel AI Gateway` reporting later if AI infrastructure changes.

## Platform Split

### PostHog

Use PostHog for:

- landing page funnel
- sign-in and sign-up CTA tracking
- onboarding and Framer setup milestones
- dashboard and settings usage
- CMS workflow adoption
- billing funnel events

### Langfuse

Use Langfuse for:

- AI request tracing
- token and cost tracking
- request/session/user linkage for AI features
- tool usage inside chat flows
- prompt and model debugging
- AI success and failure analysis

Rule:

- PostHog answers product questions.
- Langfuse answers AI quality, usage, latency, and cost questions.

## Environment

Add optional PostHog env vars:

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

Add optional Langfuse env vars:

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASEURL`

Rules:

- Both integrations must remain optional.
- Missing PostHog config disables PostHog only.
- Missing Langfuse config disables Langfuse only.
- Neither integration should block the product when unset.

## Architecture

### Client-side analytics with PostHog

Initialize PostHog once from the root app layout and wrap it behind a small local analytics helper/provider.

Use explicit named events only for:

- pageviews
- CTA clicks
- onboarding milestones
- dashboard usage
- AI panel usage
- billing CTA events

Defaults:

- no session replay
- minimize or disable autocapture
- identify only after Clerk auth context is available

### Server-side product events with PostHog

Capture authoritative product outcomes on the server for:

- post create/update/delete success and failure
- CMS action execution success and failure
- checkout and billing portal outcomes where relevant

Rule:

- client emits intent events
- server emits outcome events
- avoid duplicate terminal events

### Server-side AI tracing with Langfuse

Instrument AI routes with Langfuse traces and observations:

- one trace per AI request
- attach user, org, feature, and model metadata
- record token usage and latency when available
- record tool calls inside chat as child spans or observations
- mark request failures with normalized error metadata

Use Langfuse only on server-side AI execution paths in this phase. Do not add it to general product pages or generic CRUD routes.

## Identity and Shared Properties

### Shared product identity

Use Clerk context consistently for both systems:

- `clerk_user_id`
- `clerk_org_id`
- `site_role`
- `site_onboarding_status`

### Shared PostHog properties

- `surface`
- `feature`
- `collection_id`
- `collection_name`
- `post_id`
- `success`
- `error_type`

### Shared Langfuse metadata

- `userId`
- `sessionId` where applicable
- `orgId`
- `featureType`
- `model`
- `duration_ms`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `selected_row_count`
- `tool_count`
- `error_type`

Do not send raw prompt bodies, generated content, CMS field values, or other sensitive payloads into either system unless explicitly required later.

## Event and Trace Taxonomy

### PostHog events

#### Marketing and auth funnel

- `landing_page_viewed`
- `landing_cta_clicked`
- `sign_in_started`
- `sign_up_started`
- `onboarding_viewed`
- `onboarding_completed`

#### Framer setup and settings

- `framer_validation_requested`
- `framer_validation_succeeded`
- `framer_validation_failed`
- `framer_settings_saved`

#### Dashboard and CMS workflow

- `dashboard_viewed`
- `collection_switched`
- `post_create_requested`
- `post_created`
- `post_update_requested`
- `post_updated`
- `post_delete_requested`
- `post_deleted`
- `cms_action_approved`
- `cms_action_executed`
- `cms_action_failed`

#### Billing

- `usage_meter_viewed`
- `upgrade_clicked`
- `checkout_started`
- `billing_portal_opened`

### Langfuse traces

#### AI chat

- trace name: `ai_chat`
- metadata: selected rows count, model, org, user
- child observations: model generation, web search call, image generation call, Framer tool usage, completion result

#### AI rewrite

- trace name: `ai_rewrite`
- metadata: model, org, user, content length
- observations: generation request, completion, failure

#### AI image

- trace name: `ai_image`
- metadata: model, org, user, prompt length, reference image presence
- observations: generation attempts, retry count, completion, failure

#### AI CMS actions

- trace name: `ai_cms_action`
- metadata: action type, org, user when available
- observations: approval-triggered execution and terminal result

## Placement in This Repo

### Root app shell

Use `src/app/layout.tsx` to initialize the PostHog client provider once.

### Public landing page

Use `src/app/page.tsx` to capture:

- page viewed
- sign-in CTA click
- sign-up CTA click
- dashboard CTA click when already signed in
- onboarding/setup CTA click

### Onboarding flow

Use `src/app/onboarding/page.tsx` and `src/components/onboarding-flow.tsx` to capture:

- onboarding viewed
- Framer validation requested/result
- onboarding completed

If the onboarding component already exposes stable step state, step-level PostHog events may be added. Otherwise keep this phase milestone-based only.

### Dashboard and settings

Use:

- `src/app/dashboard/page.tsx`
- `src/app/dashboard/settings/page.tsx`
- `src/components/dashboard-table-view.tsx`
- `src/components/ai-chat-panel.tsx`
- `src/components/site-settings-form.tsx`
- `src/components/usage-meter.tsx`
- `src/components/upgrade-button.tsx`

Capture:

- dashboard viewed
- collection switched
- AI panel opened
- settings saved
- usage meter viewed
- upgrade button clicked

### Server routes

Use PostHog outcome events and Langfuse AI traces in:

- `src/app/api/posts/route.ts`
- `src/app/api/posts/[id]/route.ts`
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/rewrite/route.ts`
- `src/app/api/ai/image/route.ts`
- `src/app/api/ai/cms-action/execute/route.ts`
- billing checkout and portal routes

Rules by route type:

- posts routes: PostHog only
- AI routes: Langfuse plus minimal PostHog product-level AI usage events if needed
- CMS action execute route: PostHog for business outcomes, Langfuse if triggered from AI flow

## Implementation Rules

- Prefer explicit named events over broad automatic capture.
- Keep event names lowercase with underscores.
- Keep PostHog and Langfuse wrappers small and local to the app.
- Fail open: analytics and observability errors must never block user actions or API success paths.
- Reuse existing auth, logging, and route structure rather than introducing a new analytics architecture.
- Keep Langfuse scoped to server-side AI paths only.
- Keep PostHog scoped to product analytics, not deep prompt payload capture.

## Future Compatibility

This rollout should not block either future path:

- deeper Langfuse usage for prompt management, datasets, annotation, and evals
- `Vercel AI Gateway` custom reporting for AI spend and usage by model, provider, user, plan, or feature

To preserve that option:

- keep PostHog focused on product events
- keep Langfuse focused on AI traces
- keep model, feature, organization, and user metadata stable
- avoid coupling AI observability to a single provider implementation

## Validation Checklist

- App works normally when PostHog env vars are absent.
- App works normally when Langfuse env vars are absent.
- PostHog initializes only on the client.
- Langfuse initializes only in server-side AI execution paths.
- No session replay is enabled.
- Landing page events fire once per action.
- Authenticated identify calls include Clerk user and org context.
- Dashboard and onboarding events do not duplicate on rerender.
- Post create/update/delete routes emit one terminal PostHog outcome event each.
- AI chat, rewrite, and image routes create Langfuse traces with token and duration metadata when available.
- AI route failures are visible in Langfuse and do not break API responses.
- Billing CTA events only fire on explicit user actions.

## Defaults Chosen

- Product analytics: `PostHog`
- AI observability: `Langfuse`
- Scope: public landing page plus authenticated app
- Replay: disabled
- Instrumentation style: explicit events, not broad autocapture
- Langfuse scope: AI routes only
