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
