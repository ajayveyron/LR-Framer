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

## 2026-03-18 — Add timeout + cancel button to AI image generation

**What changed:** Added a 60-second AbortController timeout per generation attempt in the API route, an optional `AbortSignal` parameter to `generateAIImage()`, and a Cancel button in the AI image dialog during generation.

**Why:** The image generation could hang indefinitely with no way for the user to cancel or retry. Gemini image models don't support streaming partial images — they return a complete base64 blob — so the only UX option is a hard cancel via AbortController.

**Scope:** `src/app/api/ai/image/route.ts` (AbortController with 60s timeout per attempt, signal passed to `generateText`), `src/lib/ai-image-prompt.ts` (`generateAIImage` accepts optional `AbortSignal`, passes to `fetch`), `src/components/ai-image-dialog.tsx` (AbortController ref, cancel button during generating state, "Generation cancelled." message on abort).

## 2026-03-18 — Split image gen into system prompt + user prompt via generateText

**What changed:** The image generation route switched from `generateImage()` (single prompt string) to `generateText()` with Gemini's multimodal image output. The style direction (`IMAGE_SYSTEM_PROMPT`) now goes in the `system` parameter, while only the user's prompt + CMS context goes in the `prompt` parameter. The `enrichPromptForGeneration` function was removed since the route handles the split directly.

**Why:** User wants a clean separation between the persistent style direction (system prompt) and the per-request user input. `generateImage` only accepts a single `prompt` string with no system prompt support. `generateText` with Gemini image models supports a proper `system` field and returns images in `result.files`. This gives the model clearer instruction hierarchy — style rules are system-level, user intent is user-level.

**Scope:** `src/app/api/ai/image/route.ts` (switched to `generateText`, uses `config.provider()` instead of `config.provider.image()`, reads images from `result.files`), `src/lib/ai-image-prompt.ts` (exported `IMAGE_SYSTEM_PROMPT`, removed `enrichPromptForGeneration`, `buildDefaultPrompt` no longer includes style block).

## 2026-03-18 — Expose Framer Server API operations as AI chat tools

**What changed:** Added 17 new AI SDK tools to the chat route that give the AI direct access to Framer Server API operations: project info, publish info, publish site, list/get collections, get collection fields, get/add/remove collection items, set item attributes, remove single items, enum case CRUD (get/add/reorder/update/remove), and set collection as active.

**Why:** User wants the AI chat to be able to interact with the full Framer CMS — not just propose edits to selected rows, but also query project state, browse any collection, manage items across collections, manipulate enum fields, and trigger publishes. This turns the AI chat into a full CMS control plane.

**Scope:** `src/lib/framer-core.ts` (new generic Framer operations not scoped to the blog collection), `src/lib/framer.ts` (re-exports), `src/lib/framer-tools.ts` (new file — all 17 AI SDK tool definitions with Zod schemas and wide event logging), `src/app/api/ai/chat/route.ts` (imports and spreads `framerTools` into the tools map, updated system prompt to describe available tools).

## 2026-03-18 — AI chat works without row selection

**What changed:** Removed the `disabled={selectedPosts.length === 0}` constraint from the chat input textarea. Updated the system prompt to gracefully handle zero selected rows. Updated the chat panel header from "AI Edit" to "AI Assistant" — it only shows the selected row count badge when rows are actually selected. Empty state copy adapts based on whether rows are selected or not.

**Why:** With all the Framer tools now available, the AI chat is a general-purpose CMS assistant — not just a bulk edit tool. Disabling input when no rows are selected made no sense. The user should be able to open the chat and ask about anything (project info, collections, publishing, etc.) without needing to select rows first.

**Scope:** `src/components/ai-chat-panel.tsx` (removed disabled prop, adaptive header/empty state), `src/app/api/ai/chat/route.ts` (system prompt handles 0 rows gracefully).

## 2026-03-18 — Add Google Search grounding to AI chat

**What changed:** Added `google_search` as a provider tool in the AI chat route using `config.provider.tools.googleSearch({})` from `@ai-sdk/google-vertex`. Updated the system prompt to instruct the model to use web search for current/real-time information. Added a dedicated "Searched the web" pill renderer in the chat panel with a GlobeSimple phosphor icon.

**Why:** User wants the AI assistant to have web search access for answering questions about current events, latest docs, pricing, comparisons, etc. Google Search grounding via Vertex AI is the native approach — the model decides when to search and weaves results into its response automatically.

**How it works:** The `googleSearch` tool is a Vertex AI provider tool (not a custom tool). The model invokes it internally when it needs real-time web data. The grounding metadata (source URLs, search queries) comes through as provider metadata. On the client side, the tool call shows up as a `tool-google_search` message part, rendered as a compact "Searched the web" status pill.

**Scope:** `src/app/api/ai/chat/route.ts` (added google_search tool + system prompt update), `src/components/ai-chat-panel.tsx` (GlobeSimple icon import + google_search tool renderer).

## 2026-03-18 — Add AI image generation tool to chat (separate from Framer tools)

**What changed:** Added a `generate_and_upload_image` tool to the AI chat that generates images via Gemini (`gemini-3.1-flash-image-preview`) and uploads them to Framer as assets. The tool lives in its own file `src/lib/ai-image-tool.ts`, separate from the Framer tools in `src/lib/framer-tools.ts`.

**Why:** User wants the AI chat to be able to generate images on demand and set them on CMS item image fields. The tool returns a Framer asset URL that the agent can chain with `framer_set_item_attributes` using `{ type: "image", value: returnedUrl }`. Kept in a separate file because the user explicitly said "keep them separate" — image gen is a different concern from Framer CRUD operations.

**How it works:** Uses `generateText` with Gemini image model + `responseModalities: ["IMAGE", "TEXT"]` to produce an image from a text prompt. The image is extracted from `result.files`, converted to a `File` object, and uploaded via `uploadBlogAsset("image", file)`. The chat panel renders a spinner during generation, an image preview on success, and an error message on failure.

**Scope:** `src/lib/ai-image-tool.ts` (new file — tool definition), `src/app/api/ai/chat/route.ts` (imports and adds tool to tools map, updated system prompt), `src/components/ai-chat-panel.tsx` (ImageSquare icon + dedicated renderer for `tool-generate_and_upload_image` parts).

## 2026-03-18 — Dynamic brand context for image gen system prompt

**What changed:** Rewrote `IMAGE_SYSTEM_PROMPT` in `ai-image-prompt.ts` to be brand-agnostic. Added `BrandContext` interface, `buildImageSystemPrompt(brand?)` for injecting brand identity at runtime, `loadBrandContext()` that reads `brand.json` from project root (cached after first read), and `getImageSystemPrompt()` convenience async function. Both `ai-image-tool.ts` and `api/ai/image/route.ts` now use `getImageSystemPrompt()` instead of the static export.

**Why:** This is a user-facing product — different users have different brands. Hardcoding LinkRunner.io brand context was wrong. Brand info (name, aesthetic, primary color) is read from `brand.json` at runtime so each deployment gets its own brand identity in image generation.

**Scope:** `src/lib/ai-image-prompt.ts` (new `BrandContext`, `buildImageSystemPrompt`, `loadBrandContext`, `getImageSystemPrompt`), `src/lib/ai-image-tool.ts` (uses `getImageSystemPrompt()`), `src/app/api/ai/image/route.ts` (uses `getImageSystemPrompt()`).

Also added `referenceImageUrl` support to the `generate_and_upload_image` tool so user-uploaded images in chat can be passed through as style/composition references.

## 2026-03-18 — Upload image attachments to Framer before sending to AI chat

**What changed:** When a user attaches an image in the AI chat, the `onSubmit` handler now uploads it to Framer via `/api/uploads` first, replacing the base64 data URL with a short hosted Framer asset URL before calling `sendMessage`.

**Why:** The AI SDK's `PromptInput` converts attached images to base64 data URLs (~5-10MB each). These get included in the message parts and sent to the server on every subsequent message as part of conversation history. The accumulated payload was causing "Unterminated string in JSON at position 10474634" errors — the SSE response stream was ~10MB and getting corrupted/truncated. By uploading to Framer first, the URL in the message is a short HTTPS link (~100 bytes) instead of megabytes of base64.

**Scope:** `src/components/ai-chat-panel.tsx` (onSubmit handler). Also added server-side tool result truncation in `framer-tools.ts` (8KB cap via `wrapExecute`) and server-side message sanitization in `route.ts` (2KB cap on incoming tool results) as additional safety nets.

## 2026-03-18 — Use body size limit instead of temp image store for chat attachments

**What changed:** Removed the in-memory temp image store (`temp-image-store.ts`, `/api/uploads/temp` POST and GET endpoints). Instead, added `experimental.proxyClientMaxBodySize: "25mb"` to `next.config.ts` so the base64 data URL can go through on the current message. The `onSubmit` handler in the chat panel now passes files directly to `sendMessage` without any pre-upload step.

**Why:** The temp store approach failed for two reasons: (1) Next.js dev mode runs route handlers in different workers, so the GET handler couldn't find images stored by the POST handler (404). (2) Even if it worked, Vertex AI can't reach `localhost` URLs to fetch the image — it needs the image data inline. The body size limit approach is simpler and works because we already strip old images from history (client-side in `prepareSendMessagesRequest` and server-side in the chat route), so only the current message carries the large base64 payload.

**Scope:** `next.config.ts` (added `proxyClientMaxBodySize`), `src/components/ai-chat-panel.tsx` (simplified `onSubmit`), deleted `src/lib/temp-image-store.ts`, `src/app/api/uploads/temp/route.ts`, `src/app/api/uploads/temp/[id]/route.ts`.

## 2026-03-18 — Add chat conversation history with localStorage persistence

**What changed:** Added conversation persistence using localStorage and a history panel accessible via a ClockCounterClockwise (clock) icon in the AI chat header. Conversations are auto-saved after each assistant turn completes. Users can browse past conversations, restore them, or delete them. Starting a new chat saves the current conversation first.

**Why:** User wants to retain and revisit past AI chat conversations. localStorage was chosen for simplicity — no backend changes needed, conversations stay local to the browser.

**Scope:** `src/lib/chat-history.ts` (new file — save/list/load/delete with 50-conversation cap), `src/components/chat-history-panel.tsx` (new file — history list UI with back button, delete, and restore), `src/components/ai-chat-panel.tsx` (added ClockCounterClockwise icon button, showHistory state toggle, auto-save effect on status change, save-before-switch logic).

## 2026-03-18 — Cmd+K toggles AI chat, Cmd+\ focuses search

**What changed:** `Cmd+K` (or `Ctrl+K`) now toggles the AI chat panel open/closed. The search focus shortcut moved from `Cmd+K` to `Cmd+\`. The keyboard hint badge next to the search input updated from `K` to `\`.

**Why:** User wants a fast shortcut to open the AI assistant — `Cmd+K` is the most natural choice (universal command palette pattern). Search moved to `Cmd+\` to free up the K binding.

**Scope:** `src/components/dashboard-table-view.tsx` only — the `handleKeyboardShortcuts` effect and the `KbdGroup` label.

## 2026-03-18 — Move chat conversation storage from localStorage to Convex

**What changed:** Chat conversation persistence moved from browser localStorage to Convex (server-side). Added a `chatConversations` table to the Convex schema, Convex query/mutation functions in `convex/chat.ts`, and API routes at `/api/ai/chat/history` (GET/POST) and `/api/ai/chat/history/[id]` (DELETE). The `chat-history.ts` client module now calls these API routes instead of localStorage. The history panel loads conversations asynchronously with a loading spinner.

**Why:** User wants conversations stored server-side so they persist across browsers/devices and are scoped to the authenticated user's organization. localStorage was a quick prototype but not suitable for a real product.

**How it works:** Conversations are scoped by `clerkOrganizationId` + `clerkUserId`. The API routes authenticate via Clerk, then proxy to Convex using the existing `fetchProductQuery`/`fetchProductMutation` + `anyApi` pattern. Saves are fire-and-forget from the client (async but errors are swallowed to avoid breaking the chat UX). The history panel fetches on mount with a loading state.

**Scope:** `convex/schema.ts` (new `chatConversations` table), `convex/chat.ts` (new file — list/save/delete functions), `src/app/api/ai/chat/history/route.ts` (new — GET + POST), `src/app/api/ai/chat/history/[id]/route.ts` (new — DELETE), `src/lib/chat-history.ts` (rewritten — API calls instead of localStorage), `src/components/chat-history-panel.tsx` (async loading + spinner), `src/components/ai-chat-panel.tsx` (void async save calls).

## 2026-03-18 — Token-based pricing for AI usage

**What changed:** Decided on token-based pricing for all AI features (chat, image generation, etc.) rather than credit-based or tiered plans.

**Why:** Tokens are the most accurate billing unit — they map directly to actual API costs, making margins predictable. Different actions have different real costs, and tokens reflect that naturally without arbitrary credit-to-action mappings. The team is comfortable with the complexity of explaining tokens to users.

**UX approach:** Token tracking under the hood, but presented to users as a usage meter ("You've used 34% of your monthly AI allowance") rather than raw token counts. Best of both worlds — accurate billing internally, clean UX externally.

**Image generation normalization:** Image gen (which doesn't use tokens natively) will be normalized to a token-equivalent cost based on actual API pricing.

**Scope:** Affects future billing/metering implementation. No code changes yet.

## 2026-03-18 — Dodo Payments as payment provider

**What changed:** Chose Dodo Payments over Stripe and Polar.sh for handling subscriptions, usage-based billing, and payments.

**Why:** Dodo Payments acts as a Merchant of Record (MoR) — handles global tax compliance, VAT/GST, chargebacks, and fraud across 150+ countries. First-class India domestic support (UPI, local debit/credit cards) plus international coverage. Native metered billing support for token-based AI usage tracking. No need to register for GST/VAT in every country or deal with RBI recurring payment mandates manually.

**Pricing model:** Token-based AI usage tracked via Dodo's metered billing. Subscriptions with monthly token allowances. UI shows usage as a percentage meter, not raw token counts.

**Scope:** Affects future billing/payment integration. No code changes yet.

## 2026-03-18 — Remove google_search provider tool, add active collection context to AI chat

**What changed:** 
1. Removed `google_search` (Vertex AI provider-defined tool) from the AI chat tools map.
2. The client now sends `activeCollectionId` and `activeCollectionName` in the request body.
3. The system prompt now includes the active collection ID and name, with explicit instructions to use it directly instead of calling `framer_get_collections` first.
4. Added "EFFICIENCY RULES" section to the system prompt telling the model to minimize tool calls — fetch items from the active collection once, don't enumerate all collections, prefer fewer targeted calls.

**Why:** Two issues:
- `gemini-3.1-flash-lite-preview` doesn't support mixing provider-defined tools (like `google_search`) with function tools. The error `"combination of function and provider-defined tools" is not supported` caused the stream to abort with only 27 output tokens after 10 tool call steps.
- Without knowing the active collection ID, the model was calling `framer_get_collections` to discover all collections, then calling `framer_get_collection_items` for each one (10 calls for 10 collections). A simple "find 1 blog with no description" burned 210K tokens across 10 redundant fetches when it only needed 1 call to the Blog collection.

**Scope:** `src/app/api/ai/chat/route.ts` (removed google_search, added activeCollection to body schema + system prompt + efficiency rules), `src/components/ai-chat-panel.tsx` (sends activeCollectionId/Name in bodyData).

## 2026-03-19 — Web search as function tool + dangling tool call cleanup

**What changed:**
1. Created `src/lib/ai-search-tool.ts` — a regular AI SDK function tool called `web_search` that internally makes a separate `generateText` call with ONLY the `googleSearch` provider tool, then returns the grounded answer + source URLs as the tool result.
2. Wired `web_search` into the chat route tools map and updated the system prompt to mention it.
3. Added dangling tool call cleanup on both client and server: when a tool invocation is in a non-completed state (anything other than `"output-available"`), it gets patched to `"output-available"` with a `{ _cancelled: true }` output before being sent to the model. This prevents the "Tool result is missing for tool call" error that happened when the user stopped a stream mid-tool-call and then sent a new message.

**Why:**
- Web search: `gemini-3.1-flash-lite-preview` can't mix provider-defined tools (like `googleSearch` grounding) with function calling tools in the same `streamText` call. By wrapping the search in a separate `generateText` call that ONLY uses the provider tool, the main `streamText` only has function tools — no conflict.
- Dangling tool calls: When the user hits stop during a tool execution, the assistant message has a tool invocation part stuck in `"input-available"` or `"input-streaming"` state with no output. Sending this back to the model on the next message causes a "Tool result is missing" error. The cleanup patches these to look like completed-but-cancelled calls.

**Scope:** `src/lib/ai-search-tool.ts` (new file), `src/app/api/ai/chat/route.ts` (import + tool + system prompt + server-side dangling cleanup), `src/components/ai-chat-panel.tsx` (client-side dangling cleanup in `prepareSendMessagesRequest` + `web_search` tool renderer with source URL pills).

## 2026-03-19 — Hide internal IDs from AI chat responses

**What changed:** Added a "PRESENTATION RULE" to the AI chat system prompt instructing the model to never show internal IDs (collection IDs, field IDs, item IDs, enum case IDs) in user-facing responses. The model should use human-readable names only (e.g. "Blogs", "Title", "Author") and keep IDs for internal tool call use only.

**Why:** Users don't care about IDs like `esdNAc4Vu` or `nZzlIcBuJ`. When the AI listed collections or items, it was parroting the raw ID format from the system prompt context (e.g. "Testimonials (id: esdNAc4Vu)"). Clean, readable output is what matters.

**Scope:** `src/app/api/ai/chat/route.ts` (system prompt only — added presentation rule block after the field/selection context).

## 2026-03-19 — Rich UI renderers for Framer tool call outputs in AI chat

**What changed:** Added `src/components/ai-tool-renderers.tsx` with three custom renderers for Framer tool outputs in the AI chat panel:
1. Collections → card grid (2-col) with Database icon, name, readonly/managedBy badges
2. Collection items → compact table with slug, draft/published status badge, and auto-picked display columns (first 3 string fields), capped at 20 rows with overflow indicator
3. Enum cases → wrapped row of chips with Tag icon

The chat panel's catch-all `tool-*` renderer now tries `renderFramerToolOutput()` first for completed tool calls. If it returns rich UI, it renders a small label + the custom component. Otherwise falls back to the standard status pill.

**Why:** Users don't want to see raw JSON dumps from tool results. Collections, items, and enums are the most common data the AI fetches — showing them as proper UI (cards, tables, chips) makes the chat feel like a real CMS interface instead of a debug console.

**Scope:** `src/components/ai-tool-renderers.tsx` (new file), `src/components/ai-chat-panel.tsx` (import + updated tool renderer logic).

---

### Decision: AI CMS write operations require user confirmation

**Date:** 2026-03-19

**What changed:** All AI write/mutation tools (add items, remove items, update items, enum CRUD, publish) are now gated behind a confirmation UI. Instead of the AI directly executing write operations via `framer_add_collection_items`, `framer_publish`, etc., it now uses a single `propose_cms_action` tool that renders a confirmation card in the chat. The user must click "Approve" before the action executes.

- Old direct write tools removed from the AI's tool map (the underlying functions still exist for dashboard use)
- New `propose_cms_action` tool added — no-op execute, client-rendered
- New `CmsActionConfirmation` component shows action type, severity-coded styling (safe/warning/destructive), details, and Approve/Reject buttons
- New `/api/ai/cms-action/execute` route handles approved action execution server-side
- System prompt updated to instruct the AI to always use `propose_cms_action` for mutations
- Read-only tools (get collections, get items, get fields, etc.) still execute immediately

**Why:** The AI previously had unrestricted write access to the Framer CMS — asking it to add/remove items or publish would fire immediately with no confirmation. This is dangerous for a production CMS. The user wanted both a system prompt guardrail AND a proper confirmation UI (option 3).

**Scope:** `src/lib/cms-action-types.ts` (new), `src/components/cms-action-confirmation.tsx` (new), `src/app/api/ai/cms-action/execute/route.ts` (new), `src/lib/framer-tools.ts` (replaced write tools with propose_cms_action), `src/app/api/ai/chat/route.ts` (system prompt), `src/components/ai-chat-panel.tsx` (rendering).

---

### Rich Text Sparkle Icon: Image Generation → AI Rewrite (SEO/GEO/AEO)

**Date:** 2026-03-19

**Decision:** The sparkle icon in the rich text editor toolbar was repurposed from "Generate Image with AI" to "Rewrite with AI". The rewrite feature sends the current content to Gemini for SEO, GEO (Generative Engine Optimization), and AEO (Answer Engine Optimization) optimization, then shows a word-level diff comparison with accept/reject controls.

**What changed:**
- Sparkle button in `RichTextInput` now triggers `onAIRewrite` instead of `onAIImage`
- New `AIRewriteDialog` component shows inline diff (strikethrough red for removed, green for added)
- New `/api/ai/rewrite` route handles the LLM call using the text model (not image model)
- The second `AIImageDialog` (rich text inline) was removed and replaced with `AIRewriteDialog`
- The first `AIImageDialog` (for image fields) remains untouched

**Why:** The user wanted the sparkle icon to optimize content for search engines and AI answer engines rather than generate images inline. Image generation is still available on dedicated image fields.
**Scope:** `src/components/ai-rewrite-dialog.tsx` (new), `src/app/api/ai/rewrite/route.ts` (new), `src/components/post-editor.tsx` (modified).

---

### AI Rewrite: Inline in Editor, Not a Dialog

**Date:** 2026-03-19

**Decision:** The AI rewrite feature was moved from a separate dialog to being fully inline within the rich text editor. Click sparkle → fires immediately → editor area swaps to show the word-level diff (strikethrough red / green new) → accept/reject/regenerate bar appears at the bottom of the editor panel. No modal, no extra confirmation step.

**Why:** The user wanted zero friction — no dialog context switch, no "click to start" confirmation. The rewrite should feel native to the editor, not like a separate tool. The dialog file (`ai-rewrite-dialog.tsx`) was deleted entirely.
**Scope:** `src/components/post-editor.tsx` (RichTextInput now owns the full rewrite flow inline), `src/components/ai-rewrite-dialog.tsx` (deleted).

---

### AI Context Snapshot: Pre-load project/collection/enum data into system prompt

**Date:** 2026-03-19

**Decision:** Added a server-side "context snapshot" that pre-fetches project info, ALL collections (not just the active one), their fields, and enum cases for every enum field across all collections. This is injected directly into the AI chat system prompt so the agent starts every conversation already knowing the full CMS schema.

**What changed:**
- New `src/lib/ai-context-snapshot.ts` — `getAIContextSnapshot()` fetches project info + all collections + fields per collection + enum cases per enum field, all in parallel. Cached for 60s in-memory. `formatSnapshotForPrompt()` formats it as a structured system prompt block.
- `src/app/api/ai/chat/route.ts` — imports snapshot, builds it before streaming, passes the formatted block into `buildSystemPrompt()`. Updated efficiency rules to tell the agent to use pre-loaded data instead of calling `framer_get_project_info`, `framer_get_collections`, `framer_get_collection_fields`, or `framer_get_enum_cases`.

**Why:** Every new chat session, the agent was making 2-6 redundant tool calls just to discover collections, fields, project info, and enum options — data that barely changes. With multi-collection support, this would get even worse (N collections × field/enum fetches). The snapshot eliminates all discovery calls. The agent can still call the tools to refresh after a mutation.

**Scope:** `src/lib/ai-context-snapshot.ts` (new), `src/app/api/ai/chat/route.ts` (modified system prompt + snapshot injection).

## 2026-03-19 — Add retry with exponential backoff to Framer API connections

**What changed:** `withFramerProject()` in `framer-core.ts` now retries transient connection errors up to 2 times (3 total attempts) with exponential backoff (500ms, 1s). Also bumped the metadata cache TTL in `framer.ts` from 30 seconds to 5 minutes.

**Why:** The Framer API connection (`withConnection` from `framer-api`) was failing intermittently in both dev and prod with `FramerAPIError: No connection to the server`. The existing `isTransientFramerError()` detection in `framer-errors.ts` correctly identified retryable errors but nothing actually retried them — the error propagated straight to the user. The 30s metadata cache also caused excessive reconnections since metadata barely changes.

**How it works:** A new `isTransientConnectionError()` function checks `isRetryableError()` from `framer-api` plus string matching for "no connection", "session expired", and "project_closed". On transient failure, the function waits `500ms * 2^attempt` before retrying. Each retry emits a `framer.connection.retry` wide event log with attempt number, delay, error message, and project ID. Non-transient errors throw immediately without retry.

**Scope:** `src/lib/framer-core.ts` (retry wrapper around `withConnection`), `src/lib/framer.ts` (cache TTL 30s → 5min). No changes to route handlers or UI — the retry is transparent to all callers of `withFramerProject`.

## 2026-03-19 — Finalized plan token allowances

**What changed:** Set concrete token allowances for both plans: Free = 100K tokens/month, Pro = 10M tokens/month at $8/month.

**Why:** Cost analysis with actual model pricing (Gemini 3.1 Flash Lite at $0.25/1M input, $1.50/1M output for chat; Gemini 3.1 Flash Image at $0.50/$3/$60 per 1M for image gen) shows healthy margins at $8/month even with 10M tokens. Worst case all-chat usage at 10M tokens costs ~$8.75, realistic usage (~2.5M) costs ~$2-3. Free tier at 100K costs ~$0.09/month per user.

**Also fixed:** The `GEMINI_TEXT_MODEL` comment in `env.ts` incorrectly said "Gemini 3.1 Pro" but the actual model is `gemini-3.1-flash-lite-preview` (Flash Lite). Comment corrected.

**Scope:** Plan_Config in the billing spec, `src/lib/env.ts` comment fix.

## 2026-03-19 — Finalized AI plan token allowances and chat model

**What changed:** 
1. Free plan: 100K tokens/month ($0/month). Pro plan: 10M tokens/month ($8/month).
2. The AI chat model is Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite-preview`), not Gemini 3.1 Pro. Updated the billing spec glossary and introduction accordingly.
3. The AI image model remains Gemini 3.1 Flash Image Preview (`gemini-3.1-flash-image-preview`) — no change.

**Why:** User finalized the actual token budgets per plan and confirmed the real models in use. The chat route was already using Flash Lite (as seen in `env.ts` constant `GEMINI_TEXT_MODEL`), but the billing spec still referenced "Gemini 3.1 Pro" from an earlier decision. Corrected to match reality.

**Scope:** `.kiro/specs/ai-usage-billing/requirements.md` (introduction, glossary, Requirement 11 acceptance criteria).

## 2026-03-19 — Plans scoped to project/organization, not individual users

**What changed:** Subscription plans and token allowances are scoped to the Clerk organization (project), not individual user accounts. All team members in an organization share the same token pool.

**Why:** Prevents abuse from users creating temporary accounts to get multiple free tiers. A project gets one plan with one token pool — all members draw from it. Individual user usage is still tracked for per-user breakdowns, but quota enforcement happens at the org level.

**Scope:** Affects all billing requirements — subscription state, usage tracking, quota enforcement, and UI are all org-scoped.

## 2026-03-19 — Billing and plans scoped to Organization, not individual users

**What changed:** Updated the ai-usage-billing requirements to make it explicit that subscription plans, token allowances, and usage quotas are scoped to the Organization (Clerk organization / project), not to individual users. Added `Organization_Token_Pool` glossary term. Added new acceptance criteria for org-level-only quota enforcement (Req 3.6), per-user breakdown queries (Req 2.5), one-subscription-per-org constraint (Req 4.9), and anti-abuse token pool rule (Req 1.7).

**Why:** Prevents abuse from users creating temporary accounts to get multiple free tiers. All team members within an Organization share the same plan and token pool. The Free tier is per-Organization — adding new user accounts to an existing org doesn't grant extra tokens. Individual user usage is still tracked (for per-user breakdowns in the UI) but quota enforcement happens at the Organization level only.

**Scope:** Affects the entire ai-usage-billing spec — Introduction, Glossary, and Requirements 1–7, 10, 11 were updated to use "Organization" consistently and clarify the scoping model.

## 2026-03-19 — Unique Framer project ID per organization

**What changed:** Added a constraint that two organizations cannot share the same Framer project ID. If an org tries to onboard with a project ID already claimed by another org, it's rejected.

**Why:** Prevents abuse where someone connects the same Framer project to multiple orgs to double-dip on free tiers or circumvent billing. One Framer project = one organization = one plan.

**Scope:** Affects onboarding/project setup flow and the billing spec (Requirement 12).


## 2026-03-19 — Bumped FALLBACK_IMAGE_TOKEN_COST from 1,000 to 2,000

**What changed:** `FALLBACK_IMAGE_TOKEN_COST` in `src/lib/billing.ts` increased from 1,000 to 2,000 tokens per image generation.

**Why:** At 1,000 tokens, free plan users (100K allowance) could generate ~100 images — way too generous. Real Gemini 3 Pro Image pricing is ~560 input tokens + 1,120–2,000 output tokens depending on resolution. 2,000 covers the common 1K/2K case with a small buffer for 4K outputs. Free plan now allows ~50 image gens max (less in practice since chat also consumes tokens).

**Scope:** `src/lib/billing.ts` only — the `FALLBACK_IMAGE_TOKEN_COST` constant.

## 2026-03-19 — Use Dodo Checkout Sessions API instead of direct subscription creation

The original checkout route called `POST /subscriptions` directly, which requires the customer to already exist in Dodo. This caused a 404 "Customer does not exist" error for new users. Switched to `POST /checkouts` (Checkout Sessions API) which handles customer creation, payment collection, and subscription setup in a single hosted flow. The response returns `checkout_url` instead of `payment_link`. Clerk org/user IDs are passed in metadata so the webhook can link the subscription back.

## 2026-03-19 — Fix Dodo webhook signature verification to use Standard Webhooks spec

Dodo Payments uses the Standard Webhooks spec, not a simple HMAC of the body. The correct approach:
- Headers: `webhook-id`, `webhook-timestamp`, `webhook-signature` (not `x-dodo-signature`)
- Signed message: `{webhook-id}.{webhook-timestamp}.{body}`
- Secret is base64-encoded (optionally prefixed with `whsec_`)
- Signature header format: `v1,<base64sig>` (can have multiple space-separated entries)
- Payload uses `type` field (not `event_type`) and has `business_id`, `timestamp`, `data` structure

Also fixed the payload parsing to match Dodo's actual webhook format with nested `data` object containing `payload_type`, `subscription_id`, `customer`, `product_id`, `metadata`, etc.

## 2026-03-19 — Fix Dodo webhook period dates: use previous/next_billing_date

**What changed:** The webhook handler was looking for `current_period_start` / `current_period_end` in Dodo's subscription payload — fields that don't exist. Dodo uses `previous_billing_date` (cycle start) and `next_billing_date` (cycle end). Both `parsePeriodTimestamp` calls were falling back to `Date.now()`, storing near-identical timestamps as the billing cycle window.

**Fix:**
- Added `derivePeriodDates(data)` helper that reads `previous_billing_date` and `next_billing_date` from the webhook payload
- Falls back to a 1-month window anchored at `created_at` (or now) when dates are missing
- Updated all `upsertSubscription` calls to use `derivePeriodDates` instead of the broken direct field reads
- Added `subscription.renewed` event handling (was previously unhandled) since renewals update the billing period
- Added a degenerate-window guard in `getBillingCycleDates()` — if `currentPeriodEnd - currentPeriodStart < 1 hour`, falls back to calendar-month boundaries
- Added wide-event logging for raw Dodo period fields and resolved cycle dates for debugging

**Why:** After upgrading to Pro, the usage meter showed 100% because the stored period window was essentially zero-width (both start and end were the same `Date.now()` value). This caused the usage query to either return all historical tokens or zero tokens depending on timing, leading to incorrect percentage calculations.

**Scope:** `src/app/api/billing/webhook/route.ts`, `src/lib/billing.ts`, `src/app/api/billing/usage/route.ts`.

## 2026-03-19 — Cancelled/expired subscriptions fall back to Free plan

**What changed:** The usage route and `checkQuota()` now check `subscription.status === "active"` before using the subscription's plan/allowance/period dates. Cancelled or expired subscriptions are treated as if the user is on the Free plan — Free allowance, calendar-month cycle, "Free" plan name.

**Why:** When a subscription was cancelled from Dodo, the webhook correctly set `status: "cancelled"` and `monthlyTokenAllowance: 0`, but the usage route still resolved `planId: "pro"` → Pro plan definition and used the (broken) subscription period dates. This showed the user as still on Pro with 0% usage instead of dropping them to Free.

**Scope:** `src/app/api/billing/usage/route.ts`, `src/lib/billing.ts` (`checkQuota`).

## 2026-03-19 — Auto-sync subscription status from Dodo API

**What changed:** Added a `/api/billing/sync` route that fetches the subscription directly from Dodo's GET `/subscriptions/{id}` API and updates Convex with the real status, period dates, and allowance. The `useBillingUsage` hook now calls this sync endpoint automatically before fetching usage data (throttled to once per 5 minutes, reset on force refresh / tab switch).

**Why:** Dodo's cancellation webhook (`subscription.cancelled`) often doesn't reach the local dev server (ngrok not running, etc.), leaving the Convex subscription record stuck as `status: "active"` even after the subscription is cancelled in Dodo's dashboard. Without a way to sync, the platform shows stale Pro plan data indefinitely. The auto-sync ensures the platform always reflects the real Dodo subscription state within 5 minutes, regardless of whether webhooks arrive.

**Scope:** `src/app/api/billing/sync/route.ts` (new), `src/lib/use-billing-usage.ts` (auto-sync before usage fetch).

## 2026-03-20 — Performance: Suspense boundaries + non-blocking navigation

**What changed:**
1. Dashboard layout no longer blocks on `loadDashboardFramerStatus()` — the Framer health check is wrapped in its own async component inside `<Suspense fallback={null}>`, so the sidebar and shell render immediately.
2. All three dashboard content pages (`/dashboard`, `/dashboard/posts/new`, `/dashboard/posts/[id]`) now wrap `loadDashboardScreen()` in `<Suspense>` with a `DashboardTableSkeleton` fallback. The user sees the full page chrome (sidebar, toolbar skeleton, table skeleton) instantly while Framer data streams in.
3. `DashboardMainTransition` no longer blanks the entire content area with a "Loading view..." spinner during navigation. Instead it dims the current content (opacity 60%) and shows a subtle tint-colored loading bar at the top edge. The user keeps visual context of where they are.
4. Removed the `console.log` wide event that fired on every `selectedRows` state change — it was noisy and ran on every render cycle including initial mount with 0 rows.
5. `loading.tsx` for the dashboard route now uses `DashboardTableSkeleton` instead of a generic centered spinner, so Next.js route transitions also show the proper skeleton.

**Why:** The dashboard was blocking on Framer API responses before showing anything — users saw a blank screen or generic spinner for 1-5 seconds on every navigation. The goal is: user clicks a nav link → immediately sees the destination page shell with skeleton → content streams in. No blank screens, no context loss during navigation.

**Scope:** `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/posts/new/page.tsx`, `src/app/dashboard/posts/[id]/page.tsx`, `src/app/dashboard/loading.tsx`, `src/components/dashboard-navigation.tsx`, `src/components/dashboard-table-skeleton.tsx` (new), `src/components/dashboard-table-view.tsx`.

## 2026-03-20 — Migrate semantic CSS classes to inline Tailwind utilities

**What changed:** All semantic CSS classes from `@layer components` in `globals.css` (e.g. `.framer-shell`, `.dashboard-topbar-control`, `.settings-section`, `.framer-callout-info`, etc.) were replaced with inline Tailwind utility strings directly in each component's JSX. The entire `@layer components` block was stripped from `globals.css` except for `framer-editor-prose` (targets nested child elements — can't be expressed as parent-level Tailwind utilities) and `.framer-status-banner-active` (CSS variable rule for banner offset).

**Why:** User wants styles co-located with markup using Tailwind utilities for easier maintenance. Semantic CSS classes created an indirection layer — you had to jump between the component and `globals.css` to understand what a class did. An intermediate `tw-classes.ts` shared constants file was tried but the user rejected it — having to jump to a separate TS file is the same indirection problem. Styles should live right where they're used so they can be edited in place.

**Scope:** All dashboard components and pages. `src/app/globals.css` (stripped `@layer components`), ~27 component/page files updated with inline Tailwind utilities. `src/lib/tw-classes.ts` was created then deleted.

---

### Replaced verbose `var(--framer-*)` CSS arbitrary values with semantic Tailwind color tokens

**Date:** 2026-03-20

**What changed:** All inline Tailwind classes using verbose `var(--framer-fresco-*)`, `var(--framer-dashboard-*)`, and `var(--framer-app-*)` CSS variable references (e.g. `text-[color:var(--framer-fresco-panelTitle-color)]`, `bg-[var(--framer-dashboard-control-background-color)]`) were replaced with clean semantic Tailwind tokens (e.g. `text-fresco-title`, `bg-dash-control-bg`). Dashboard-level and missing app-level tokens were added to the `@theme inline` block in `globals.css`. For cases where arbitrary values are still needed (inside `shadow-[...]`, `color-mix()`, gradients), the long `--framer-*` var names were shortened to their `--color-*` token equivalents.

**Why:** The verbose `var(--framer-fresco-panelTitle-color)` pattern defeats the purpose of having a design system — it's unreadable, error-prone, and makes class strings absurdly long. The `@theme inline` block already had most fresco tokens mapped but they weren't being used. Dashboard-level tokens were missing entirely.

**Scope:** `src/app/globals.css` (added ~20 new `--color-dash-*` and `--color-fresco-*` token mappings to `@theme inline`, added `--framer-app-background-color` definition to `.dark`), ~37 component/page/lib files updated across `src/`.

## 2026-03-20 — Raised AI agent step limit and tool result truncation

**What changed:** Bumped `stepCountIs` from 10 to 20 in the chat route, and increased `MAX_TOOL_RESULT` from 2,000 to 10,000 chars in `ai-guardrails.ts`.

**Why:** The previous limits were too restrictive — 10 steps cut off complex multi-step CMS operations, and 2k char truncation clipped useful tool result context.

**Scope:** `src/app/api/ai/chat/route.ts` (step limit), `src/lib/ai-guardrails.ts` (truncation limit).

## 2026-03-21 — Agent memory across conversations

**What changed:** Added a `save_preference` tool to the AI chat agent that persists user preferences, corrections, and workflow habits to a new `agentMemories` Convex table. Memories are loaded at the start of each chat request and injected into the system prompt so the agent remembers things across conversations.

**Why:** The agent previously started fresh every conversation with no recall of past interactions. Repeat users had to re-state preferences every time. Memory makes the agent feel personal and reduces friction.

**Scope:** New Convex table `agentMemories` with `listMemories`, `saveMemory`, `deleteMemory` functions. New API route `GET/POST /api/ai/memory`. New `src/lib/ai-memory.ts` helper for loading and formatting memories. `save_preference` tool added to the chat route's tool set. System prompt updated to include memory block and instructions for when to save memories silently.

**Design:** Memories are org+user scoped, capped at 50 per user, deduplicated by content within category. Three categories: preference, correction, workflow. The agent saves memories proactively without asking permission. Memory loading is fail-open (empty array on error) so it never blocks chat.

## 2026-03-21 — Inline AI nudges on blog table rows

**What changed:** Blog table rows now show a subtle sparkle icon (on hover) next to the title when the post has content quality issues. Clicking the sparkle selects that post, opens the AI chat panel, and auto-sends a contextual prompt asking the agent to help fix the issues.

**Why:** The AI agent previously lived only in the side panel — users had to context-switch into the chat to get help. Inline nudges pull the agent into the user's natural workflow by surfacing actionable suggestions directly on the table.

**Scope:** New `src/lib/content-nudges.ts` utility that analyzes posts for: short/missing titles, empty/short body content, missing image fields, and stale drafts (>7 days). `BlogTable` component gets `nudges` and `onNudgeClick` props. `DashboardTableView` computes nudges via `useMemo`, handles nudge clicks by selecting the row + opening chat + queuing a prompt. `AIChatPanel` gets `pendingPrompt`/`onPendingPromptConsumed` props to auto-send queued prompts.

## 2026-03-21 — Parallelized chat route prefetch to reduce time-to-first-token

**What changed:** The `/api/ai/chat` POST handler now runs quota check, AI context snapshot, and agent memory loading in a single `Promise.all` instead of sequentially. The `requireDashboardApiAccess` helper also now runs `syncMembership` and `getSiteForOrganization` in parallel. The snapshot cache TTL was bumped from 60s to 5 minutes.

**Why:** First responses were taking ~20 seconds. The waterfall was: auth → syncMembership → getSite → quotaCheck (2 Convex queries) → snapshot (Framer API calls) → memory load → stream. Parallelizing the independent steps and extending the cache TTL significantly reduces the pre-stream latency.

**Scope:** `src/app/api/ai/chat/route.ts` (parallel prefetch), `src/lib/product-access.ts` (parallel membership sync + site fetch in `requireDashboardApiAccess`), `src/lib/ai-context-snapshot.ts` (cache TTL 60s → 300s).


## 2026-03-21 — Reposition billing from Free/Pro $8 to Free/Standard $19

**What changed:** Renamed the paid plan from "Pro" ($8/mo) to "Standard" ($19/mo) across the entire codebase. Updated `PLAN_CONFIG` in `billing.ts` (key changed from `pro` to `standard`, price from 8 to 19, name from "Pro" to "Standard"). Updated the env var from `DODO_PRO_PRODUCT_ID` to `DODO_STANDARD_PRODUCT_ID` in `env.ts`. Updated all user-facing labels: upgrade buttons, usage meter, AI chat quota gates, and checkout route. Added backwards-compat mapping in `getPlanById` so existing subscriptions with `planId: "pro"` still resolve correctly.

**Why:** GTM plan repositions the product around a tighter wedge — internal Framer CMS ops for teams. Standard at $19 with unlimited members is the only live paid plan. Agency ($49) is roadmap-only marketing copy, not a live checkout option.

**Scope:** `src/lib/billing.ts`, `src/lib/env.ts`, `src/components/upgrade-button.tsx`, `src/components/usage-meter.tsx`, `src/components/ai-chat-panel.tsx`, `src/app/api/billing/checkout/route.ts`.

## 2026-03-21 — Rewrite landing page for workflow-first positioning

**What changed:** Rewrote `src/app/page.tsx` from a broad "AI-native Framer ops" story to a tighter workflow-first promise. New hero: "Run your Framer CMS with your team, outside the editor." Replaced value props with: "Connect one Framer site fast", "Invite your internal team", "Use AI to edit and review faster". Added pricing section (Free, Standard $19 highlighted, Agency $49 coming soon), how-it-works steps, who-it's-for section, and FAQ. Removed "AI-Native Framer Ops" badge, generic AI framing, and the gradient background.

**Why:** GTM plan says to lead with the team CMS workflow, not "AI-native ops". AI is the accelerator, not the headline. Pricing section shows all three tiers but only Free and Standard are actionable.

**Scope:** `src/app/page.tsx` only.

## 2026-03-21 — Free plan limited to 1 invited teammate

**What changed:** Added invite gating to `TeamManager` component. Free plan users can invite at most 1 teammate beyond the owner. When the limit is reached, the Invite button is replaced with an upgrade prompt ("Free plan allows 1 invited teammate" + "Upgrade for unlimited members" button). Uses `useBillingUsage` hook to detect the current plan. Standard plan has no invite limit.

**Why:** GTM plan specifies Free tier allows exactly 1 invited teammate beyond the owner. This creates a natural upgrade trigger when teams grow.

**Scope:** `src/components/team-manager.tsx` only.

## 2026-03-21 — Remove Notion from public-facing product story

**What changed:** Verified that no user-facing dashboard pages reference Notion. The `NotionBridgeState` component exists but is not imported anywhere in the dashboard. The landing page no longer mentions Notion, backend syncs, or generic "AI-native ops" framing. Notion backend code remains untouched for internal team use.

**Why:** GTM plan says to remove Notion from the public product story. The Notion bridge is internal-only and should not appear in customer-facing surfaces.

**Scope:** Landing page copy only. No backend Notion code was changed.

## 2026-03-21 — CMS image alt text preservation + site insights pill

**What changed:**
1. `extractFieldValue` and `serializeFieldData` in `framer-core.ts` now preserve alt text on image fields. Images return `{ url, alt }` objects instead of just URL strings.
2. `DashboardFieldValue` union in `cms-types.ts` extended to include `{ url: string; alt: string | null }`.
3. New `scanMissingAltText()` and `scanSiteInsights()` functions in `content-nudges.ts` scan all posts for images missing alt text and produce site-level insights.
4. New `SiteInsightsPill` component in `site-insights-overlay.tsx` — a pill button in the dashboard toolbar that shows a count of active insights. Clicking opens a dropdown overlay with insight cards. Each card has "Fix with AI" (opens chat with prefilled prompt) and "Dismiss" (persisted to localStorage).
5. `ai-tool-renderers.tsx` updated to handle `{ url, alt }` image objects in the collection items table and truncate helper.
6. `formatDisplayValue` in `framer-core.ts` updated to handle `{ url, alt }` objects (returns the URL string).
7. AI chat system prompt updated with IMAGE ALT TEXT section explaining how to read/write alt text on CMS image fields.

**Why:** CMS images were losing alt text during read/write cycles because `extractFieldValue` stripped it to just the URL string and `serializeFieldData` didn't pass it through. This hurt accessibility and SEO. The site insights pill surfaces this proactively so users can fix it with one click via the AI agent.

**Scope:** `src/lib/framer-core.ts`, `src/lib/cms-types.ts`, `src/lib/content-nudges.ts` (new site insight functions), `src/components/site-insights-overlay.tsx` (new), `src/components/dashboard-table-view.tsx`, `src/components/blog-table.tsx`, `src/components/ai-tool-renderers.tsx`, `src/app/api/ai/chat/route.ts`.

## 2026-03-21 — Inline contentEditable chip input for AI chat selected rows

**What changed:** Replaced the overlay/padding workaround for showing selected post chips in the AI chat input with a proper `contentEditable`-based `ChipInput` component (`src/components/chip-input.tsx`). Selected post chips now render inline before the text cursor inside the input area — like Cursor/Kiro file reference chips.

**Why:** The previous approach used absolutely positioned chip overlays above the textarea with `pt-10` padding to push text down. User rejected this as a workaround — wanted true inline chips that flow with the text cursor, which is the industry standard pattern (Cursor, ChatGPT, Kiro all do this). A `<textarea>` can't render inline elements, so a `contentEditable` div with non-editable chip spans was the correct approach.

**How it works:** The `ChipInput` component renders a flex-wrap container with `contentEditable={false}` chip spans followed by a `contentEditable` text span. Text syncs bidirectionally with the `usePromptInputController` text state. Enter submits the parent `PromptInput` form, Shift+Enter allows newlines, paste handles both files (delegated to attachments) and plain text (strips formatting). The editable span uses CSS `[&:empty]:before:content-[attr(data-placeholder)]` for placeholder text.

**Scope:** `src/components/chip-input.tsx` (new file), `src/components/ai-chat-panel.tsx` (replaced overlay approach in `ChatInputOrQuotaGate` with new `ChipInputPromptArea` component, removed `PromptInputTextarea` import).

## 2026-03-21 — AI agent transparency: narrate between tool calls

**What changed:** Added a "TRANSPARENCY RULE — narrate your process" section to the AI chat system prompt. The agent is now instructed to briefly tell the user what it's about to do before each tool call, share observations between tool calls, and summarize after completing a task. It must not silently chain multiple tool calls in a row without any text between them.

**Why:** The agent was too "actionable" — it would fire off a sequence of tool calls back-to-back with zero intermediary messages, then dump a summary at the end. The user couldn't tell what was happening or why. Adding narration makes the agent feel more like a collaborator walking you through its process.

**Scope:** `src/app/api/ai/chat/route.ts` (system prompt only). Also cleaned up a duplicate orphaned `TOOL RESULT DISPLAY RULE` header that was left from the edit.

## 2026-03-21 — AI image generation: reference existing collection images + topic-specific prompts

**What changed:** Added an "IMAGE GENERATION — reference existing collection images" section to the AI chat system prompt. The agent is now instructed to:
1. Look at existing images in the same collection before generating a new one.
2. Pass a representative existing image URL as `referenceImageUrl` to `generate_and_upload_image`.
3. Write detailed, topic-specific prompts based on the blog post title/content — never generic abstract images.

**Why:** When asked to generate a thumbnail for a blog post, the agent fetched collection items to see other thumbnails but didn't pass any existing thumbnail URL as `referenceImageUrl`. It also generated a generic abstract image unrelated to the blog post topic. The new instructions ensure visual consistency with the collection's existing style and topical relevance to the post content.

**Scope:** `src/app/api/ai/chat/route.ts` (system prompt only).

## 2026-03-21 — Convert AI context snapshot from blocking prefetch to visible tool call

**What changed:** The Framer project context snapshot (all collections, fields, enum cases) is no longer fetched in a blocking `Promise.all` before `streamText` starts. Instead, it's exposed as a `get_project_context` tool that the agent calls visibly on its first turn. The system prompt has a "FIRST TURN RULE" instructing the agent to always call this tool first and narrate it ("Let me load the project context first…").

**Why:** The snapshot fetch could take 2-5 seconds depending on how many collections/fields the project has. During that time the stream hadn't started yet, so the user saw zero activity — just a stuck loading state. Converting it to a tool means `streamText` starts immediately, the agent outputs text right away ("Let me load the project context…"), and the user sees the tool call spinner while the snapshot loads. Much better perceived performance.

**Scope:** `src/app/api/ai/chat/route.ts` (removed snapshot from `Promise.all`, added `get_project_context` tool, updated system prompt with FIRST TURN RULE and EFFICIENCY RULES), `src/components/ai-chat-panel.tsx` (added Database icon + `tool-get_project_context` renderer).

## 2026-03-21 — Replace console.log debug dumps with structured wide-event logging

**What changed:** Removed the `console.log("================ AI RAW REQUEST ================")` and `console.log("================ AI RAW RESPONSE ================")` debug dumps from the chat route. Replaced with proper `logEvent` calls: `ai.chat.system_prompt` (logs prompt length, row count, message count, model) and `ai.chat.completed` (logs duration, token usage, model). Image gen tool now logs the full prompt text, reference URL, context title/slug, asset URL, mime type, and image size in bytes.

**Why:** Console.log dumps are noisy, unstructured, and hard to search. Wide-event structured JSON logs are the project standard — they're filterable, parseable, and work with log aggregation tools. The image gen tool now logs everything you need to debug quality issues: what prompt went in, what reference image was used, and what came out.

**Scope:** `src/app/api/ai/chat/route.ts` (replaced console.logs with logEvent), `src/lib/ai-image-tool.ts` (enriched log events with full prompt, reference URL, context, and output details).

## 2026-03-21 — Relax post schema to passthrough unknown fields and make all field values optional

**What changed:** In `post-schema.ts`, changed `z.object(fieldShape).strict()` → `z.object(fieldShape).passthrough()` on the `fieldValues` sub-schema, and removed `.strict()` from the outer schema. All individual field schemas (string, number, boolean, multiReference) are now always `.optional()` at the Zod level. Required-ness is still enforced inside `superRefine` when a value IS provided, but `undefined` no longer causes a type error.

**Why:** The Framer collection can have fields added/removed at any time. When new fields appear in Framer, the form doesn't know about them yet, so the PUT payload includes field IDs the schema hasn't seen — `.strict()` rejected those as "unrecognized keys". Similarly, the form only sends fields it renders, so fields the schema expects but the form doesn't send arrive as `undefined` — the old non-optional schemas rejected those as "expected string, received undefined". Both caused ZodErrors on save.

**Scope:** `src/lib/post-schema.ts` (schema relaxation), `src/lib/post-schema.test.ts` (split the combined test into separate enum validation and passthrough tests).

## 2026-03-21 — Add Unpublish button to post editor, respect draft flag on update

**What changed:**
1. `handleUpdatePost` in `post-route-logic.ts` now reads `body.draft` and sets `publish: !isDraft`. Previously it hardcoded `draft: body.draft ?? false, publish: true`, meaning every update auto-published regardless of intent.
2. `submitValues` in `post-editor.tsx` now accepts an optional `asDraft` parameter. When truthy, it sends `draft: true` in the payload.
3. Added an "Unpublish" button in the editor header for edit mode when the post is currently published (`!post.draft`). Clicking it saves the current form values with `draft: true`, which sets the item as draft in Framer without publishing.

**Why:** There was no way to move a published post back to draft status from the dashboard. The update handler always published, and the editor had no UI for it.

**Scope:** `src/components/post-editor.tsx` (Unpublish button + `asDraft` param on `submitValues`), `src/lib/post-route-logic.ts` (conditional publish based on draft flag).

## 2026-03-21 — Fix collection context mismatch on client-side post API calls

**What changed:** Added `getCollectionHeader()` helper to `product-framer-shared.ts` that reads the active collection ID from the `lr-active-collection` cookie and returns it as an `x-framer-collection-id` header. All client-side `fetch` calls to `/api/posts` now include this header: post editor save, table draft toggle, table delete, AI bulk apply, AI post refresh, and edit proposal view.

**Why:** The server resolves the active collection from (in priority order): query param → `x-framer-collection-id` header → cookie → site default → first collection. When the user switches collections in the dashboard, the cookie updates, but the server-side route handler was sometimes resolving to a different collection than the one the user was viewing. This caused "Blog post not found" errors because the post existed in collection A but the server was looking in collection B. Sending the header explicitly from the client ensures the server always uses the correct collection.

**Root cause from logs:** Post `ZpIjoTPfM` was being looked up in "Case Studies" (collection `wL5B2TE8R`, 2 items) when it actually lived in a different collection. The cookie was stale or the fallback resolution picked the wrong collection.

**Scope:** `src/lib/product-framer-shared.ts` (new `getCollectionHeader` helper), `src/components/dashboard-table-view.tsx`, `src/components/post-editor.tsx`, `src/components/ai-chat-panel.tsx`, `src/components/edit-proposal-view.tsx`, `src/lib/ai-bulk-apply.ts` (all fetch calls updated).

## 2026-03-22 — Upgrade intent flow from landing page pricing CTA

**What changed:** The "Start Standard" button on the landing page pricing section now sets `localStorage.setItem("upgrade_intent", "standard")` and links to `/sign-up?intent=upgrade` (or `/dashboard/billing?intent=upgrade` for signed-in users). After onboarding completes, the flow checks localStorage for the upgrade intent and redirects to `/dashboard/billing?intent=upgrade` instead of `/dashboard`. The billing page has an `AutoCheckoutTrigger` component that detects the `?intent=upgrade` query param, auto-fires the Dodo checkout redirect for org admins, and cleans up both the localStorage flag and the URL.

**Why:** Previously the "Start Standard" CTA just redirected to `/dashboard/billing` or `/sign-up`, which meant the user had to manually find and click the subscribe button after completing sign-up + onboarding. The Dodo checkout API requires an authenticated org context (orgId, userId, email), so it can't be triggered from the public landing page directly. The localStorage + query param approach bridges the gap — the intent survives the sign-up → onboarding → dashboard flow and auto-triggers checkout as soon as the user lands on the billing page with full auth context.

**Scope:** `src/app/page.tsx` (pricing CTA uses `UpgradeIntentLink`), `src/components/upgrade-intent-link.tsx` (new client component), `src/components/onboarding-flow.tsx` (checks localStorage for redirect target), `src/components/auto-checkout-trigger.tsx` (new client component), `src/app/dashboard/billing/page.tsx` (renders `AutoCheckoutTrigger` in Suspense).

## 2026-03-26 — Async background image generation in AI chat

**What changed:** The `generate_and_upload_image` AI tool no longer blocks the chat stream while Gemini generates an image (90+ seconds). Instead, it returns immediately with a `jobId` and fires off the actual generation + Framer upload in the background. The frontend polls `/api/ai/image/generate-async/[jobId]` every 2 seconds and renders a live progress card (queued → generating → done/failed). The agent is free to continue writing blog content, fetching context, or proposing CMS actions while the image cooks.

**Why:** Previously the tool's `execute` function awaited the full Gemini `generateText` call + Framer asset upload synchronously inside `streamText`. This blocked the entire agent stream — the user saw "Pondering..." for 90+ seconds with zero progress, and the agent couldn't do anything else in that time. For a "write a blog post with a cover image" flow, this meant the agent had to finish image gen before it could even start writing the post content.

**How it works:** An in-memory job store (`src/lib/ai-image-jobs.ts`) tracks pending/running/completed/failed jobs. The tool creates a job, fires off `runImageGeneration()` with `void` (fire-and-forget), and returns `{ async: true, jobId }` to the stream. The frontend's `AsyncImageCard` component uses a `useImageJob` polling hook to watch the job status. Token tracking and billing still happen inside the background closure. The system prompt was updated to tell the agent it can continue immediately and should NOT try to chain image gen with `propose_cms_action` in the same turn.

**Scope:** `src/lib/ai-image-tool.ts` (tool now dispatches async), `src/lib/ai-image-jobs.ts` (new in-memory job store), `src/lib/use-image-job.ts` (new polling hook), `src/app/api/ai/image/generate-async/[jobId]/route.ts` (new poll endpoint), `src/components/async-image-card.tsx` (new live progress component), `src/components/ai-chat-panel.tsx` (renders AsyncImageCard for async results, keeps legacy sync fallback), `src/app/api/ai/chat/route.ts` (system prompt updated for async behavior).

## 2026-03-26 — Add workspace switching for multi-org users

**What changed:** Multi-org users can now switch workspaces from three places:
1. Onboarding step 1 (Connect Framer) shows a "Switch workspace" back link to `/select-workspace`
2. Dashboard sidebar shows the current workspace name with a switch link at the bottom (only for multi-org users)
3. Settings page has a new "Workspace" section with a "Switch workspace" button (only for multi-org users)

All three use Clerk's `useOrganizationList` to detect multi-org membership and hide themselves for single-org users.

**Why:** Users belonging to multiple Clerk organizations were getting stuck on the Framer project setup page during onboarding with no way to navigate back to workspace selection. The redirect loop between `/onboarding` → `/dashboard` made it impossible to switch to a different org.

## 2026-03-26 — Resend for transactional emails instead of Clerk built-in emails

**What changed:** Added Resend integration for sending custom transactional emails triggered by Clerk webhooks and billing events. Three email templates created: welcome (user.created), team invitation (organizationInvitation.created), and pro upgrade congratulatory (subscription.active). Clerk webhook route at `/api/webhooks/clerk/route.ts` verifies signatures via svix and dispatches emails. Pro upgrade email fires from the existing billing webhook after subscription activation.

**Why:** Clerk's built-in email templates are limited (full customization requires Pro plan) and don't cover billing events. Resend gives us full control over email design, branding, and triggers — all managed in our codebase as React components via `@react-email/components`. Email is optional — if `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are not set, everything degrades gracefully.

**Env vars needed:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (e.g. `FramerLink <hello@yourdomain.com>`), `CLERK_WEBHOOK_SECRET` (from Clerk Dashboard webhook config).

**Scope:** `src/lib/env.ts` (Resend env validation), `src/lib/email.ts` (Resend client + sendEmail helper), `src/emails/` (3 React email templates), `src/app/api/webhooks/clerk/route.ts` (new Clerk webhook handler), `src/app/api/billing/webhook/route.ts` (pro upgrade email trigger added).

## 2026-03-26 — Include reference collection options in AI context snapshot

**What changed:** The `get_project_context` tool now fetches items from all referenced collections (Person, Authors, etc.) and includes them in the snapshot as `REFERENCE COLLECTION OPTIONS`. Each option shows the item's label, ID, and slug. Field definitions for `collectionReference` / `multiCollectionReference` fields now also show which collection they reference (e.g. `→ references "Person"`).

**Why:** The AI was generating `"Bad reference"` errors when creating blog posts because it didn't know the valid item IDs for reference fields like Person. The system prompt said "value must be the ITEM ID" but the snapshot only included field type info — not the actual available options. The AI guessed slugs like `"lakshith-dinesh"` instead of the real Framer item ID. Now the snapshot gives the AI a complete lookup table of valid reference options, just like it already did for enum cases.

**Scope:** `src/lib/ai-context-snapshot.ts` — added `ReferenceSnapshot` type, `collectionId` to `FieldSnapshot`, reference collection fetching in `getAIContextSnapshotWithRunner`, and reference options formatting in `formatSnapshotForPrompt`.

## 2026-03-26 — CMS action execution is now part of the agent's turn via needsApproval

**What changed:** The `propose_cms_action` tool now uses the AI SDK's built-in `needsApproval: true` pattern instead of a no-op execute + separate client-side fetch to `/api/ai/cms-action/execute`. When the user approves, the tool's `execute` function runs server-side within the `streamText` context, and the result flows back to the agent as a tool output. The agent then responds based on the outcome.

**How it works:**
1. Agent calls `propose_cms_action` → SDK pauses execution, sends `approval-requested` state to client
2. Client renders Approve/Reject buttons via `CmsActionConfirmation` (now driven by SDK state, not internal useState)
3. User clicks Approve → `addToolApprovalResponse({ id, approved: true })` → SDK auto-sends via `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`
4. Server-side `execute` runs the actual Framer mutation → result returns to agent
5. Agent sees the result and responds:
   - Success: tells user it went through, mentions slug/item
   - Rejected: graceful "no worries" response, does NOT retry
   - Failed: reads error, explains what went wrong, attempts fix and retry

**Why:** Previously the agent was blind to outcomes — it proposed an action and never learned if it succeeded, failed, or was rejected. The user had to manually report errors. Now the agent owns the full lifecycle: propose → wait for approval → see result → react. This enables automatic retry on failure (e.g. bad reference ID → look up correct one → re-propose).

**Scope:** `src/lib/framer-tools.ts` (needsApproval + real execute), `src/lib/normalize-field-data.ts` (extracted shared helper), `src/components/cms-action-confirmation.tsx` (rewritten for SDK states), `src/components/ai-chat-panel.tsx` (addToolApprovalResponse + sendAutomaticallyWhen), `src/app/api/ai/chat/route.ts` (system prompt updated with result handling rules), `src/app/api/ai/cms-action/execute/route.ts` (kept as fallback, uses shared normalizeFieldData).

## 2026-03-26 — Add maxOutputTokens and content length guidance to AI chat

**What changed:** 
1. Added `maxOutputTokens: 8192` to the `streamText` call in the AI chat route as a safety net to give the model room for long-form content.
2. Added a content length instruction to the "NEW ITEM CREATION RULES" section of the system prompt: formattedText/body fields should be 800–1500 words minimum with proper HTML structure, matching existing collection depth. No stubs or placeholders.

**Why:** The AI was generating very short blog posts (~100 words) when asked to create new items. Two causes: (1) the previous model (`gemini-3.1-flash-lite-preview`) was a lite variant optimized for speed/cost, not long-form generation — user has since upgraded the model. (2) No explicit instruction in the system prompt told the model to write comprehensive content. The `maxOutputTokens` cap ensures the model has headroom even if the default is conservative.

**Scope:** `src/app/api/ai/chat/route.ts` (system prompt + streamText config).

## 2026-03-26 — Enable thinking mode + ChainOfThought UI + blog preview card

**What changed:**
1. Enabled Gemini thinking via `providerOptions.vertex.thinkingConfig.thinkingLevel: "low"` on the `streamText` call. The AI SDK already streams reasoning parts by default (`sendReasoning: true`).
2. Created `src/components/ai-elements/chain-of-thought.tsx` — a collapsible component using Radix Collapsible that renders reasoning parts from the AI. Shows a "Thinking…" shimmer while streaming, collapses to "Thought process" when done.
3. Added a `render_blog_preview` no-op tool that the AI calls to display full blog post content in a rich preview card before proposing a CMS write. The card (`src/components/blog-preview-card.tsx`) renders HTML content in a scrollable prose container with a copy button.
4. Added "BLOG PREVIEW RULE" to the system prompt instructing the AI to always call `render_blog_preview` before `propose_cms_action` when creating or rewriting blog posts.

**Why:** Thinking mode improves reasoning quality for complex CMS tasks. The ChainOfThought UI makes the thinking process visible and transparent. The blog preview card solves the problem of long blog content being buried in tool result tables — users can now read and review the full article inline before approving the CMS write.

**Scope:** `src/app/api/ai/chat/route.ts` (providerOptions, new tool, system prompt), `src/components/ai-elements/chain-of-thought.tsx` (new), `src/components/blog-preview-card.tsx` (new), `src/components/ai-chat-panel.tsx` (reasoning + blog preview renderers).

## 2026-03-26 — Redesign CMS action confirmation UI with expandable rows and draft fix

**What changed:**
1. Rewrote `src/components/cms-action-confirmation.tsx` — replaced flat truncated tables with expandable collapsible rows. Each item in an `add_items` proposal is now a clickable row that expands to show all field values with proper rich content rendering (HTML via `framer-editor-prose`, images, booleans, long text).
2. Fixed the draft status display bug — the old `draft !== false` check showed "Draft" when `draft` was `undefined`, which was misleading since Framer defaults to published. Now uses `draft === true` explicitly, and shows a green "Published" badge when items will be published.
3. Added per-action-type icons (Plus for add, Pencil for edit, Trash for remove) on each expandable row for visual clarity.
4. Batch approve button now shows "Approve all N" when multiple items are in the proposal.
5. Added "CMS MUTATION RULES" to the system prompt instructing the AI to always set `draft: true` on new items via `propose_cms_action`, since the product rule is that new posts land as drafts.

**Why:** The old flat table was terrible — content was truncated to 36 chars, rich HTML showed as raw `<p dir="auto">...`, there was no way to inspect individual items, and the status was wrong (showing Published for items that should be drafts). The new design lets users expand each item to see full field values with proper rendering before approving.

**Scope:** `src/components/cms-action-confirmation.tsx` (full rewrite), `src/app/api/ai/chat/route.ts` (system prompt addition).

## 2026-03-26 — Add item preview drawer to CMS action confirmation

**What changed:**
Replaced the custom field-value preview with the real `PostEditor` component. When you click an add_items or set_item_attributes row in the confirmation card, a drawer opens to the left of the AI chat panel (portaled into `#dashboard-shell`, positioned at `right: min(48vw, 640px)`) containing the full PostEditor with all fields, rich text toolbar, image uploads, enum selects — the exact same editor used in the main dashboard. A synthetic `BlogPostRecord` is constructed from the proposal's field data and passed to PostEditor. The AI chat sheet's `onInteractOutside` handler checks for `[data-cms-preview-drawer]` to prevent the chat from closing when interacting with the preview. Escape closes the preview drawer first (captured in the capture phase before Radix's handler).

**Why:** User wanted the actual post editor form — not a simplified field list — so they can see exactly how the content will look with all the real form controls, rich text rendering, and field layout before approving.

**Scope:** `src/components/cms-action-confirmation.tsx` (PostPreviewDrawer with real PostEditor, synthetic post construction), `src/components/ai-chat-panel.tsx` (pass `metadata` prop, `onInteractOutside` guard).

## 2026-03-26 — Staged items: AI-created items land locally before Framer

**What changed:**
1. Added `stagedItems` table to Convex schema — stores items per org/collection with full field data JSON, source (ai/manual), and timestamps. Indexed by org+collection.
2. Created `convex/stagedItems.ts` with CRUD mutations: `create`, `update`, `remove`, `removeBatch`, `listByCollection`.
3. Created API routes: `GET/POST /api/staged-items` and `DELETE/PATCH /api/staged-items/[id]` for client-side operations.
4. Created `src/lib/staged-items.ts` — server-side loader that converts Convex staged items into `BlogPostRecord` objects with `staged: true` and `stagedId` set.
5. Extended `BlogPostRecord` type with optional `staged` and `stagedId` fields.
6. Updated all three dashboard pages (`page.tsx`, `posts/[id]/page.tsx`, `posts/new/page.tsx`) to load staged items and prepend them to the posts array.
7. Updated `BlogTable` to render a third "Staged" group at the top with a green "Staged" badge. Context menu shows "Push to Framer" and "Discard" for staged items instead of "Publish"/"Delete".
8. Updated `DashboardTableView` — `onDraftToggle` for staged items pushes to Framer via POST /api/posts then removes from Convex. `onDelete` for staged items calls DELETE on the staged items API.
9. Updated `propose_cms_action` tool in `framer-tools.ts` — when `stagingContext` is provided (product mode), `add_items` creates staged items in Convex instead of pushing directly to Framer. Returns `staged: true` in the result.
10. Updated `createScopedFramerTools` to accept optional `stagingContext` with `organizationId` and `userId`.
11. Updated chat route to pass staging context to `createScopedFramerTools`.
12. Fixed AI field completeness — added instruction to the system prompt telling the AI to populate ALL available fields when creating or editing items.

**Why:** Items created by AI should not go directly to Framer CMS. They need a staging area where users can review, edit, and explicitly push when ready. "Staged" is the git metaphor — ready to commit but not yet pushed. This gives users full control over what lands in their live CMS.

**Scope:** `convex/schema.ts`, `convex/stagedItems.ts` (new), `src/lib/staged-items.ts` (new), `src/lib/cms-types.ts`, `src/lib/framer-tools.ts`, `src/app/api/ai/chat/route.ts`, `src/app/api/staged-items/route.ts` (new), `src/app/api/staged-items/[id]/route.ts` (new), `src/app/dashboard/page.tsx`, `src/app/dashboard/posts/[id]/page.tsx`, `src/app/dashboard/posts/new/page.tsx`, `src/components/blog-table.tsx`, `src/components/dashboard-table-view.tsx`, `src/components/cms-action-confirmation.tsx`.

## 2026-03-26 — Platform-wide code refactor (zero behavior changes)

**What changed:**
1. Consolidated duplicated meter state logic — removed dead `getMeterState` + `MeterState` type from `billing.ts` (never imported), renamed `deriveMeterState` → `getMeterState` in `use-billing-usage.ts` as the canonical client-side version.
2. Standardized error response handling — two routes (`meta/fields`, `notion/import`) were using `getErrorResponse()` directly instead of `createErrorJsonResponse()`. Switched them to the standard helper and made `getErrorResponse` private.
3. Consolidated duplicated transient Framer error patterns — `framer-copy.ts` and `framer-errors.ts` had identical pattern lists. Initially consolidated into `framer-errors.ts` as single source of truth, but this pulled the server-only `framer-api` package into client components via transitive import. Reverted and kept the duplication intentional with a comment explaining the client/server boundary.
4. Removed dead code — `toTransientFramerAppError` (exported, never imported), `getFramerStatusDetail` (exported, never imported), unused `AppError` and `TRANSIENT_FRAMER_SHORT_MESSAGE` imports in `framer-errors.ts`.
5. Replaced `console.error` with structured `logError` in `notion/import` route for logging consistency.
6. Removed empty API directories (`auth/login`, `auth/logout`, `config`, `publish`, `uploads/temp`, `uploads/temp/[id]`).

**Why:** Reduce cognitive complexity, eliminate duplication (DRY), standardize patterns across the codebase, and remove dead code — all without changing any business logic, APIs, or user-facing behavior.

**Scope:** `src/lib/billing.ts`, `src/lib/use-billing-usage.ts`, `src/lib/api.ts`, `src/lib/framer-errors.ts`, `src/lib/framer-copy.ts`, `src/components/ai-chat-panel.tsx`, `src/components/usage-meter.tsx`, `src/app/api/meta/fields/route.ts`, `src/app/api/notion/import/route.ts`.

## 2026-03-27 — Remove inline blog preview card, enforce post length and field completeness

**What changed:**
1. Removed the `render_blog_preview` tool from the AI chat route and the "BLOG PREVIEW RULE" from the system prompt. The inline rich text preview card was redundant since users already review content by opening the post editor from the CMS action confirmation card.
2. Removed the `BlogPreviewCard` rendering block and import from `ai-chat-panel.tsx`. The component file `blog-preview-card.tsx` is left in place but no longer referenced.
3. Strengthened the "CMS MUTATION RULES" in the system prompt to explicitly require: enum fields (Category) must always be set using case IDs from project context; collectionReference fields (Person/Author) must always be set using item IDs from the referenced collection; image fields must always get a freshly generated thumbnail via `generate_and_upload_image` (never copy an existing item's URL); string fields like Description must match existing item style/length.
4. Strengthened the "NEW ITEM CREATION RULES" to explicitly require 800–1500 word blog posts matching existing collection length, instead of the vague "comprehensive, publication-ready content" instruction.

**Why:** The blog preview card added an extra tool call step that slowed down content creation without adding value (the post editor already serves as the review surface). Posts were being created with only 300-400 words instead of matching the 800-1500 word standard of existing posts. Required fields like Person and Category were being left empty, and thumbnails were being copied from existing posts instead of freshly generated.

**Scope:** `src/app/api/ai/chat/route.ts` (removed tool definition, removed BLOG PREVIEW RULE, strengthened CMS MUTATION RULES and NEW ITEM CREATION RULES), `src/components/ai-chat-panel.tsx` (removed BlogPreviewCard import and rendering block).

## 2026-03-27 — Fix thinking UI not showing + update retired image model

**What changed:**
1. Added `sendReasoning: true` to the `toUIMessageStreamResponse` call in the chat route. Without this flag, the Vercel AI SDK strips reasoning parts from the stream, so the ChainOfThought component in the chat panel never receives data to render.
2. Updated `GEMINI_IMAGE_MODEL` from `gemini-2.5-flash-image-preview` (retired October 31, 2025) to `gemini-2.5-flash-image` (stable, active until October 2, 2026).

**Why:** Users reported the thinking UI shimmer/disclosure never appeared despite `thinkingLevel: "low"` being configured. The reasoning data was being generated server-side but silently dropped before reaching the client. Image generation was failing with a 404 because the preview model was retired.

**Scope:** `src/app/api/ai/chat/route.ts` (added `sendReasoning: true`), `src/lib/env.ts` (updated `GEMINI_IMAGE_MODEL` constant).
