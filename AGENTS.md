# AGENTS.md

## Purpose

This repo is Framer Bot: a Next.js App Router app for onboarding a Framer project, managing CMS content across user-managed collections, and optionally running AI and billing workflows. It also contains an internal-only Notion-to-Framer bridge used by the team for operational syncs.

Agents working here should optimize for safe, incremental changes and avoid breaking org-scoped access, Framer runtime context, or CMS write paths.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4 with Radix/shadcn UI primitives
- Clerk for auth and organizations
- Convex for product state, onboarding, memberships, and usage
- `framer-api` for Framer CMS access
- Vercel AI SDK with Google Vertex for chat, rewrite, and image tooling
- Dodo Payments for billing and webhooks
- Zod for env validation and schema checks

## Key Commands

- `npm run dev` starts local development
- `npm run lint` runs ESLint
- `npm run typecheck` runs TypeScript checks
- `npm run test` runs the Node/TS test suite
- `npm run framer:check` validates the legacy Framer connection using `.env`

## Working Rules

- Do not run `npm run build` unless the user explicitly asks. It runs `npx convex deploy && next build --webpack`.
- Prefer `npm run typecheck`, `npm run lint`, and `npm run test` for validation after code changes. Use the smallest relevant set.
- Only run `npm run framer:check` when the task touches Framer behavior and the legacy bridge env vars are present.
- Keep changes org-scoped. Do not bypass Clerk/Convex access checks, onboarding gating, or encrypted Framer API key handling.
- Preserve graceful degradation when optional integrations are missing. Missing AI, billing, or Notion config should not break the base dashboard.
- Do not commit or revert unrelated user changes.
- Keep edits small and localized. Reuse existing helpers before adding new abstractions.
- Never ever try to touch or modify the ENV file ever. nor through your tool calls or terminal use. in no way you should be able to make changes to env file. neither by copying env exmple into env

## Product Model

- Each Clerk organization maps to one `ProductSite` record in Convex.
- Onboarding persists validated Framer project details before a site becomes `ready`.
- Dashboard and API requests run inside a per-site Framer runtime context derived from stored settings.
- One collection is stored as the default site collection, but the dashboard can switch across user-managed collections within the connected Framer project.

## Project Map

- `src/app/page.tsx`, `src/app/sign-in`, and `src/app/sign-up` handle the marketing and auth entry points.
- `src/app/onboarding` contains the team setup and Framer validation flow.
- `src/app/dashboard` and `src/app/dashboard/(workspace)` contain the authenticated CMS, team, settings, and billing screens.
- `src/app/api/posts`, `src/app/api/meta/fields`, and `src/app/api/uploads` are the main CMS APIs.
- `src/app/api/onboarding/*` and `src/app/api/dashboard/settings/*` manage product onboarding and saved Framer settings.
- `src/app/api/ai/*` contains chat, rewrite, image, history, and CMS action endpoints.
- `src/app/api/billing/*` contains checkout, portal, usage, sync, and webhook handlers.
- `src/app/api/notion/*` contains the optional Notion bridge routes.
- `src/components` contains dashboard, workspace, AI, onboarding, billing, and shared UI components.
- `src/lib/framer.ts`, `src/lib/framer-core.ts`, `src/lib/framer-runtime.ts`, `src/lib/framer-tools.ts`, and related helpers contain Framer runtime, caching, snapshots, onboarding validation, and CMS mutations.
- `src/lib/product-*.ts` contains product env validation, access control, team/site settings, and active-collection resolution.
- `src/lib/ai-*.ts` contains AI config, guardrails, parsers, prompt helpers, and tool integrations.
- `src/lib/billing.ts` and `src/lib/use-billing-usage.ts` hold plan definitions, quota logic, and usage helpers.
- `src/lib/notion.ts` and `src/lib/notion-bridge-core.ts` handle the Notion bridge.
- `src/lib/env.ts` validates legacy Framer, Notion, AI, and Dodo billing env vars.
- `src/lib/product-env.ts` validates Clerk, Convex, and encryption env vars for product mode.
- `src/lib/app-config.ts` and `src/lib/app-config.json` hold hardcoded app-level Framer/Notion config.
- `scripts/check-framer.mjs` is the manual Framer connectivity check.
- `scripts/framer-rpc.mjs` is a small local RPC wrapper around core Framer helpers.

## External Services

### Framer

Product mode:

- Framer API keys are collected during onboarding, encrypted, and stored per organization.
- A default collection ID and name are stored on the site record, but runtime selection can switch to other user-managed collections.

Important behavior:

- Create flows should keep creating drafts unless the user requests a behavior change.
- Update flows currently publish edited posts automatically. Treat that as intentional behavior unless asked to change it.
- Delete flows exist through the posts API and currently publish changes automatically. Treat that as intentional unless asked to change it.
- Dashboard overview data is cached and can fall back to persisted snapshots when Framer is transiently unavailable.

Legacy bridge mode:

- `FRAMER_API_KEY` is still used by the legacy `.env`-driven bridge and `npm run framer:check`.

### Clerk + Convex

Core env vars:

- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_DEPLOY_KEY`
- `PRODUCT_ENCRYPTION_KEY`

Important behavior:

- Keep auth and role checks centralized in `src/lib/product-access.ts`.
- Persist product and membership data through the existing Convex helpers instead of adding ad hoc storage.
- Do not move encrypted secret handling out of the existing product settings helpers without a clear reason.

### AI / Vertex AI

Optional env vars:

- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`

Important behavior:

- AI features are optional. Missing AI env should disable AI routes cleanly without breaking the rest of the app.
- Preserve guardrails, quota checks, token tracking, and confirmation-based CMS mutations when changing AI flows.

### Billing

Optional env vars:

- `DODO_API_KEY`
- `DODO_WEBHOOK_SECRET`
- `DODO_PRO_PRODUCT_ID`
- `DODO_BUSINESS_ID`

Important behavior:

- Billing should degrade gracefully when Dodo config is missing.
- Keep plan definitions and allowance logic centralized in `src/lib/billing.ts`.

### Notion Bridge

The Notion integration is optional, completely internal, and not user-facing. Treat it as an internal team bridge for syncing between Notion and Framer, not as a product feature customers interact with.

If `NOTION_*` vars are not configured, the dashboard should still work normally.

When changing Notion sync behavior:

- preserve the current fallback behavior for syncing approved pages
- keep `appConfig.notion.fieldMap` support intact
- avoid requiring Notion config for non-Notion dashboard work
- avoid surfacing Notion concepts, setup, or bridge-specific UX in the customer-facing product unless the user explicitly asks for that change

## Editing Guidance

- Follow the existing App Router and product-access patterns instead of introducing a new architecture.
- Reuse helpers in `src/lib/product-access.ts`, `src/lib/product-framer.ts`, and `src/lib/framer-runtime.ts` before adding duplicate auth or context wiring.
- Keep env validation centralized in `src/lib/env.ts` and `src/lib/product-env.ts`.
- If changing Framer field mapping or item payloads, consider manual dashboard edits, AI-driven CMS actions, and Notion-triggered syncs.
- If changing collection selection or dashboard loading, preserve stale snapshot fallback behavior for transient Framer failures.
- Keep billing and AI changes aligned with org-scoped quota and role behavior.
- Do not add new destructive CMS behavior unless the user explicitly asks for it. Existing delete behavior should remain explicit and deliberate.

## Verification Guidance

Use the smallest relevant verification set:

- UI or route changes: `npm run typecheck`
- Lint-sensitive changes: `npm run lint`
- Pure logic changes in `src/lib` or tests: `npm run test`
- Framer integration changes: `npm run framer:check` only when legacy env is configured and the check is relevant

If verification cannot run because env vars or network access are unavailable, state that clearly.
