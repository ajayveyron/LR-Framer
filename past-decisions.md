# Past Decisions

## 2026-03-12 — Disable auto-publish on Notion bridge sync

**What changed:** `syncBridgePostsWithLoadedContext` in `framer-core.ts` no longer auto-publishes after syncing bridge posts from Notion. The `maybePublishChanges` call was changed from `true` to `false`.

**Why:** The user wants to retain final verification control before publishing. Notion-synced content should land in the Framer CMS as unpublished so the user can review and publish manually.

**Note:** Manual dashboard edits (create/update) still follow their existing publish behavior — creates are drafts, updates auto-publish. This change only affects the Notion bridge sync path.

## 2026-03-12 — Draft Framer posts when Notion status leaves "Approved"

**What changed:** When a Notion page's status changes from "Approved" to something else, the bridge now syncs the post to Framer as a draft (`draft: true`) instead of deleting it from the CMS.

**Why:** The user wants unapproved pages to be drafted in Framer, not removed. Only archived/trashed pages should be removed.

**Scope:** Only affects the single-page webhook path in `syncApprovedNotionPages`. The `allApproved` bulk sync path is unchanged.

## 2026-03-12 — Auto-derive slug from title when slug is empty

**What changed:** `parsePostInput` in `post-schema.ts` no longer requires a non-empty slug upfront. If the slug is empty, it derives one from the title field value using `slugify()`. If neither slug nor title produces a valid slug, validation still fails.

**Why:** The user wants the slug to be auto-generated from the title when left empty, reducing friction during post creation.

**Scope:** Affects both dashboard create and update flows (anything going through `parsePostInput`). The Notion bridge already had its own title-to-slug fallback in `getBridgePageIdentifiers` — that remains unchanged.

## 2026-03-12 — No automatic deletion of Framer posts from any source

**What changed:** A "Deleted" status trigger was considered and rejected. No deletion logic exists anywhere — not in the Notion bridge, not in the dashboard.

**Why:** Too risky. Accidental actions could wipe Framer CMS posts. If a post needs to be removed, do it directly in Framer. The dashboard and bridge are strictly for creating, editing, and syncing content — never deleting.

## 2026-03-18 — Settings page restyled to Framer-like contained dark sections

**What changed:** Settings pages (`/dashboard/settings` and `/dashboard/settings/team`) now use a grey background shell (`settings-shell`) with contained dark section boxes (`settings-section`) and filled dark inputs (`settings-input`). This replaces the previous flat transparent-border layout.

**Why:** User wants the settings UI to match the Framer site settings aesthetic — grey background, contained black/dark rounded section boxes, and filled (not outline) inputs. Cleaner visual hierarchy.

**Scope:** Affects `globals.css` (new `.settings-shell`, `.settings-section`, `.settings-input` classes), both settings page files, `settings-nav.tsx`, `site-settings-form.tsx`, and `team-manager.tsx`.

## 2026-03-18 — Merged settings into single page, removed tabs and header

**What changed:** The separate `/dashboard/settings/team` page was removed. Both the Framer connection form and the Team manager now live on a single `/dashboard/settings` page, stacked vertically. The settings nav tabs and the "Workspace settings" / kicker header were removed. The page now has a compact back-button + "Settings" heading row.

**Why:** User wants a simpler, flatter settings layout — no unnecessary navigation or headers. Everything on one page.

**Design tokens confirmed:** Shell bg `#1D1D1D`, input fill `#2B2B2B` with no border (blue border on focus only), headings Inter 22px/700/-0.8px, body/labels Inter 12px/500.

## 2026-03-18 — Use Google Vertex AI instead of Google AI Studio for AI features

**What changed:** All AI features in the Super CMS spec now use `@ai-sdk/google-vertex` (Google Vertex AI) instead of `@ai-sdk/google` (Google AI Studio). Auth uses `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` env vars instead of `GOOGLE_GENERATIVE_AI_API_KEY`.

**Why:** User decided to go with Google Vertex AI for all AI use cases (bulk editing, image generation). Vertex AI provides enterprise-grade access to Gemini models with GCP project-level auth.

**Scope:** Affects the AI SDK integration requirement (Requirement 5) in the ai-super-cms spec. All AI endpoints (AI_Agent, AI_Image_Generator) will use the Vertex AI provider.

## 2026-03-18 — Use Vercel AI SDK built-in patterns and tool calls for speed

**What changed:** The AI Super CMS design now leverages Vercel AI SDK's built-in hooks, streaming patterns, and tool call mechanism instead of custom implementations. Edit proposals use SDK `tool` definitions with Zod schemas (via `toolInvocations` on messages) instead of parsing fenced JSON blocks from message content.

**Why:** User wants to use Vercel AI SDK templates/components to speed up development. The SDK provides `useChat`, `streamText`, `tool` definitions, and `experimental_generateImage` out of the box — no need to build custom streaming, protocol handling, or JSON parsing.

**Scope:** Affects the design of `/api/ai/chat` route (uses `tool` + `streamText` + `toDataStreamResponse`), `AIChatPanel` component (uses `useChat` with `body` for context, `toolInvocations` for edit proposals), and image generation (uses `experimental_generateImage`).

## 2026-03-18 — Use Vercel AI Elements for chat UI components

**What changed:** The AI Chat Panel will use Vercel AI Elements — a shadcn-style component registry that provides production-ready chat UI components (Conversation, Message, PromptInput, Tool, Loader). Components are installed as source files via `npx ai-elements@latest add` into `src/components/ai-elements/` and are fully customizable.

**Why:** User wants to leverage Vercel AI SDK templates/components to speed up development. AI Elements integrates directly with `useChat` and handles streaming states, markdown rendering, tool call display, and auto-scrolling out of the box. Since we're already on shadcn/ui, React 19, and Tailwind CSS 4, it's a perfect fit — no custom chat UI plumbing needed.

**Scope:** Affects the AIChatPanel component design. The panel composes AI Elements components (Conversation, Message, PromptInput, Tool) with a custom edit proposal view on top. Image generation dialogs remain custom since AI Elements doesn't cover that use case.

## 2026-03-18 — Hardcode Gemini 3.1 Pro + Nano Banana Pro as AI models

**What changed:** Replaced env-configurable `GEMINI_MODEL` / `GEMINI_IMAGE_MODEL` with hardcoded constants: `gemini-3.1-pro-preview` (text) and `gemini-3.1-flash-image-preview` (image/Nano Banana 2). Removed the env vars and `DEFAULT_GEMINI_MODEL` / `DEFAULT_GEMINI_IMAGE_MODEL` from `env.ts`. Only `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` remain as env vars for AI.

**Why:** User wants to use Gemini 3.1 Pro for text generation and Nano Banana 2 (Gemini 3.1 Flash Image) for image generation. Both are Gemini models (no Imagen). Model names are hardcoded since they won't change per-environment — simplifies config. Nano Banana 2 chosen over Pro for faster speed and lower cost while maintaining quality.

**Scope:** `src/lib/env.ts` (removed model env vars, added `GEMINI_TEXT_MODEL` and `GEMINI_IMAGE_MODEL` constants), `src/lib/ai-config.ts` (reads from constants), integration tests (hardcoded model names).

## 2026-03-18 — Simplified tool call schema to match model's natural output

**What changed:** The `propose_edits` tool schema was simplified from `changes: { fieldId: { fieldName, currentValue, proposedValue } }` to `changes: { fieldId: newValue }`. The `FieldChange` interface was removed. `parseEditProposals` now returns `Record<string, DashboardFieldValue>` for changes. `EditProposalView` looks up field names from metadata and current values from the post data.

**Why:** The model naturally produces flat `{ fieldId: value }` maps. The nested `FieldChange` format caused Zod validation failures (tool went to `output-error` state with `hasInput: false`), resulting in a blank UI despite successful API responses. Designing schemas to match what the model naturally produces avoids validation mismatches.

**Scope:** `ai-edit-parser.ts` (simplified `ProposedEdit` type), `edit-proposal-view.tsx` (added `fieldDefinitions` prop), `ai-bulk-apply.ts` (reads raw values), `ai-chat-panel.tsx` (passes metadata, cleaned up debug logs), `route.ts` (updated system prompt), both test files.

## 2026-03-18 — Parallel bulk apply instead of sequential

**What changed:** `applyBulkEdits` now fires all PUT requests in parallel using `Promise.allSettled` instead of awaiting each one sequentially in a `for...of` loop.

**Why:** Sequential PUTs were slow — applying 5 edits took ~99 seconds because each waited for the previous to complete. Parallel execution brings this down to roughly the time of the slowest single request.

**Scope:** `src/lib/ai-bulk-apply.ts` only. The `succeeded`/`failed` partitioning behavior is preserved — property-based tests still pass.

## 2026-03-18 — Split image gen into system prompt + user prompt via generateText

**What changed:** The image generation route switched from `generateImage()` (single prompt string) to `generateText()` with Gemini's multimodal image output. The style direction (`IMAGE_SYSTEM_PROMPT`) now goes in the `system` parameter, while only the user's prompt + CMS context goes in the `prompt` parameter. The `enrichPromptForGeneration` function was removed since the route handles the split directly.

**Why:** User wants a clean separation between the persistent style direction (system prompt) and the per-request user input. `generateImage` only accepts a single `prompt` string with no system prompt support. `generateText` with Gemini image models supports a proper `system` field and returns images in `result.files`. This gives the model clearer instruction hierarchy — style rules are system-level, user intent is user-level.

**Scope:** `src/app/api/ai/image/route.ts` (switched to `generateText`, uses `config.provider()` instead of `config.provider.image()`, reads images from `result.files`), `src/lib/ai-image-prompt.ts` (exported `IMAGE_SYSTEM_PROMPT`, removed `enrichPromptForGeneration`, `buildDefaultPrompt` no longer includes style block).
