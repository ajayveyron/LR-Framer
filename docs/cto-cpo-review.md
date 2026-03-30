# CTO/CPO Codebase Review — FramerBot

> **Date:** 2026-03-31
> **Scope:** Security, Architecture, UX, Accessibility, Infrastructure, Design Consistency
> **Verdict:** Well-conceived AI-native CMS product with real differentiation. Critical gaps in CI/CD, error tracking, rate limiting, accessibility, and god components block a confident production launch.

---

## What's Actually Good

These are genuine strengths worth preserving:

- **Content nudges system** — analyzing posts for quality issues and generating AI prompts is a killer feature
- **Zod env validation** — graceful degradation for optional features, proper issue reporting
- **Property-based testing** for AI parsers — sophisticated approach to testing AI output handling
- **AI guardrails** with dedicated prompt injection detection and tests
- **Structured error handling** — `AppError` with HTTP codes, centralized `createErrorJsonResponse`
- **Framer transient error detection** — comprehensive pattern matching for retry logic
- **Onboarding flow** — lean 2-step setup with progressive validation
- **AI suggestion chips** — different suggestions for empty chat vs. selected posts
- **Encrypted API key storage** — proper at-rest encryption for third-party credentials

---

## 1. Security

| # | Issue | Severity | File | Status |
|---|-------|----------|------|--------|
| 1.1 | **No rate limiting on any API route** — the AI chat endpoint (`maxDuration: 120`) is especially exploitable. A single bad actor can run up your Vertex AI bill indefinitely. | Critical | All `/api/*` routes | ☐ |
| 1.2 | **Middleware auth bypass** — when Clerk is not configured, all routes are unprotected. Several routes (`/api/billing/*`, `/api/staged-items/*`, `/api/notion/*`) are not in the middleware matcher. | Critical | `src/middleware.ts` | ☑ |
| 1.3 | **IDOR in staged items** — DELETE/PATCH operations don't verify organization ownership at the Convex layer. Any authenticated user could modify another org's staged items. | High | `convex/stagedItems.ts` | ☑ |
| 1.4 | **No security headers** — no CSP, HSTS, X-Frame-Options, X-Content-Type-Options. For a CMS app that renders user-generated HTML, this is an XSS risk. | High | `next.config.ts` | ☑ |
| 1.5 | **Single encryption key with no rotation** for stored Framer API keys. If `PRODUCT_ENCRYPTION_KEY` is compromised, all keys are exposed with no rotation mechanism. | Medium | `src/lib/crypto.ts` | ☐ |
| 1.6 | **Fail-open quota checks** — if the billing API call fails, the user is allowed to proceed rather than blocked. | Medium | `src/lib/billing.ts` | ☑ |

**Fix:** Add `upstash/ratelimit` to AI routes immediately. Add org-ownership checks to all Convex mutations. Add security headers in `next.config.ts` `headers()`.

---

## 2. Architecture & Code Quality

| # | Issue | Severity | File | Status |
|---|-------|----------|------|--------|
| 2.1 | **`post-editor.tsx` is 2,469 lines** — contains a rich-text editor, HTML sanitizer, markdown shortcuts, diff engine, AI rewrite workflow, image uploader, and the full form layout. Any change is high-risk. | Critical | `src/components/post-editor.tsx` | ☐ |
| 2.2 | **`dashboard-table-view.tsx` has inline `fetch()` calls** inside JSX event handlers with `console.error` only. Business logic mixed into rendering. | High | `src/components/dashboard-table-view.tsx` | ☐ |
| 2.3 | **Race condition in AI chat** — `pendingPrompt` effect can double-fire, sending the same message twice and wasting metered tokens. | High | `src/lib/use-ai-chat-session.ts:407-424` | ☑ |
| 2.4 | **Unsafe `(part as any)` casts** throughout the AI tool system. A single SDK update will silently break tool rendering with no compile-time warning. | High | `ai-chat-panel.tsx`, `use-ai-chat-session.ts` | ☐ |
| 2.5 | **N+1 query in `serializePost`** — 3 `getPluginData` calls per item. 100 items = 300 round-trips to Framer API on dashboard load. | High | `src/lib/framer-core.ts:490-502` | ☐ |
| 2.6 | **Module-level mutable state** (`cachedDataSource`, `snapshotCache`) — unreliable in serverless, unbounded growth in long-running processes. | Medium | `src/lib/notion.ts:105`, `ai-context-snapshot.ts:79` | ☐ |
| 2.7 | **Duplicated utilities** — `mapWithConcurrency` in 2 files, `looksLikeHtml` in 3 files, `JSON.stringify` equality in 2 files (key-order dependent, silently wrong). | Medium | Multiple files | ☑ |
| 2.8 | **Dead code** — AI rewrite toolbar commented out but all supporting logic still compiled into the bundle. Bridge status badge commented out. | Low | `post-editor.tsx:1334`, `dashboard-table-view.tsx:654` | ☑ |
| 2.9 | **No Error Boundary around AI Chat** — a single malformed tool result crashes the entire dashboard. | High | `ai-chat-panel.tsx` | ☑ |

**Fix:** Split `post-editor.tsx` into 5+ focused modules. Extract API mutations from table view into a `useCmsMutations` hook. Add discriminated union types for AI tool parts. Add Error Boundaries around AI rendering.

---

## 3. UX & Product

| # | Issue | Severity | File | Status |
|---|-------|----------|------|--------|
| 3.1 | **No empty state** when dashboard table has zero items — just blank space with "Showing 0 of 0". Need illustration + CTA. | High | `dashboard-table-view.tsx:891` | ☑ |
| 3.2 | **No undo for any destructive action** — deletion, publish toggle, team member removal are all immediate and permanent. | High | Multiple | ☐ |
| 3.3 | **Publish toggle inconsistency** — PostEditor has a confirmation dialog for publishing, but the table toggle does not. Same action, different safety levels. | High | `dashboard-table-view.tsx:746` | ☑ |
| 3.4 | **No optimistic updates** — draft toggles and deletions wait for full server round-trip before updating UI. Feels sluggish. | Medium | `dashboard-table-view.tsx` | ☐ |
| 3.5 | **AI chat panel width is fixed pixels** (min 380px). On tablets/small laptops, it crushes the content table to ~200px. Needs breakpoint to switch to full-screen overlay. | Medium | `dashboard-table-view.tsx:51-53` | ☑ |
| 3.6 | **Team manager uses `alert()` and `confirm()`** — native browser dialogs that break the design language and are inaccessible. | Medium | `team-manager.tsx:80,92,100` | ☑ |
| 3.7 | **Onboarding API key not persisted** — if user closes browser mid-setup, they must re-enter the API key. | Low | `onboarding-flow.tsx:98-124` | ☐ |
| 3.8 | **"See setup flow" CTA on homepage links to authenticated `/onboarding`** — unauthenticated users get a confusing redirect. | Low | `page.tsx:129` | ☑ |
| 3.9 | **Agency pricing tier "Coming soon" button** has no waitlist/email capture — missed lead gen. | Low | `page.tsx:390` | ☐ |
| 3.10 | **Cmd+K shortcut for AI chat** is bound but never visually hinted in the UI. | Low | `dashboard-table-view.tsx` | ☑ |

---

## 4. Accessibility

| # | Issue | Severity | File | Status |
|---|-------|----------|------|--------|
| 4.1 | **Hero h1 text color `#5a5a5a` on `#0A0A0A` background** = ~3.3:1 contrast ratio. **Fails WCAG AA.** | Critical | `src/app/page.tsx` | ☑ |
| 4.2 | **Rich text editor has no `role="textbox"`, no `aria-label`, no `aria-multiline`**. Screen readers can't identify it. | Critical | `src/components/post-editor.tsx` | ☑ |
| 4.3 | **`window.prompt()` for link insertion** in editor — inaccessible native dialog. | High | `src/components/post-editor.tsx:1125` | ☑ |
| 4.4 | **No skip navigation link** on any page. | High | `src/app/layout.tsx` | ☑ |
| 4.5 | **Onboarding step dots have no ARIA semantics** — no `role="progressbar"`, no `aria-current="step"`. | Medium | `src/components/onboarding-flow.tsx:50-72` | ☑ |
| 4.6 | **Mobile nav missing `SheetDescription`** for screen readers. | Medium | `src/components/dashboard-sidebar.tsx` | ☑ |

---

## 5. Infrastructure & DevOps

| # | Issue | Severity | File | Status |
|---|-------|----------|------|--------|
| 5.1 | **Zero CI/CD** — no GitHub Actions, no automated testing, linting, or type checking on PRs. | Critical | (missing) | ☑ |
| 5.2 | **No error tracking** — no Sentry, Bugsnag, or Datadog. Unhandled errors in production are silently lost. | Critical | (missing) | ☐ |
| 5.3 | **`build` script deploys Convex to production** as a side effect (`npx convex deploy && next build`). Every build mutates production infrastructure. | Critical | `package.json` | ☑ |
| 5.4 | **Test coverage ~10%** — 10 test files covering only pure utilities. Zero component tests, zero E2E tests, zero API route tests. | High | (missing) | ☐ |
| 5.5 | **`.env.example` lists 5 of 18+ required vars** — new developers will be stuck. | High | `.env.example` | ☑ |
| 5.6 | **No health check endpoint** — no uptime monitoring possible. | Medium | (missing) | ☑ |
| 5.7 | **No database cleanup strategy** — `processedWebhooks`, `aiUsageRecords`, `chatConversations` tables grow unbounded. | Medium | `convex/schema.ts` | ☐ |
| 5.8 | **Dual export in `next.config.ts`** — both `module.exports` and `export default`. | Low | `next.config.ts` | ☑ |
| 5.9 | **Duplicate icon libraries** (lucide-react + @phosphor-icons/react) and `shadcn` CLI as a production dependency. | Low | `package.json` | ☐ |

---

## 6. Design Consistency

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 6.1 | **Border radius inconsistency** — `rounded-xl`, `rounded-lg`, `rounded-[24px]`, `rounded-[20px]` used interchangeably | Low | ☐ |
| 6.2 | **Font size inconsistency** — Dashboard `text-[12px]`, AI elements `text-[13px]`, marketing `text-[14px]`/`text-[15px]` | Low | ☐ |
| 6.3 | **Marketing page uses hardcoded hex** instead of the Fresco token system used in the dashboard | Low | ☐ |
| 6.4 | **Dead light-mode CSS** — root layout hardcodes `dark` class but light-mode CSS variables exist | Low | ☑ |
| 6.5 | **Footer legal links point to `/`** — Terms and Privacy both link to homepage | Low | ☑ |

---

## Prioritized Action Plan

### P0 — Do Before Shipping

1. Add CI/CD (GitHub Actions: lint + typecheck + test)
2. Add Sentry for error tracking
3. Add rate limiting to `/api/ai/*` routes
4. Fix WCAG contrast failure on hero heading
5. Add ARIA roles to rich text editor
6. Add Error Boundary around AI chat panel
7. Fix middleware matcher to cover all protected routes
8. Add org-ownership validation to Convex mutations

### P1 — This Sprint

9. Separate `convex deploy` from `next build`
10. Split `post-editor.tsx` into focused modules
11. Extract API mutations from `dashboard-table-view.tsx`
12. Add security headers (CSP, HSTS, etc.)
13. Add empty state to dashboard table
14. Replace all `alert()`/`confirm()`/`prompt()` with Dialog components
15. Add confirmation for publish toggle in table view

### P2 — Next Sprint

16. Add E2E tests (Playwright) for critical flows
17. Add optimistic updates for CMS operations
18. Add responsive breakpoint for AI chat panel
19. Complete `.env.example` with all 18+ vars
20. Add database TTL/cleanup for unbounded tables
21. Fix `JSON.stringify` equality to use proper deep-equal
22. Add mobile navigation to marketing page

### P3 — Track as Tech Debt

23. Deduplicate icon libraries (pick one)
24. Remove dead code (commented-out features)
25. Extract duplicated utilities (`looksLikeHtml`, `mapWithConcurrency`)
26. Add light mode support or remove dead light-mode CSS
27. Replace `useEffectEvent` (experimental) with stable pattern
28. Add bundle analysis and optimize
