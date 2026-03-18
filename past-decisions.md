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
