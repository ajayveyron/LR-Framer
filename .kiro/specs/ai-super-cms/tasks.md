# Implementation Plan: AI Super CMS

## Overview

Incrementally add AI-powered capabilities to the existing FramerLink CMS dashboard: multi-row selection, bulk AI editing via chat panel, and AI image generation in both image fields and rich text content. All AI features use the Vercel AI SDK with Google Vertex AI (Gemini models). Each task builds on the previous, ending with full integration.

## Tasks

- [x] 1. Install dependencies and AI Elements components
  - Run `npm install ai @ai-sdk/react @ai-sdk/google-vertex`
  - Run `npm install -D fast-check`
  - Run `npx ai-elements@latest add conversation message prompt-input tool loader` (installs into `src/components/ai-elements/`)
  - Tell the user to add `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and optionally `GEMINI_MODEL` to their `.env` file
  - _Requirements: 5.1, 5.4_

- [ ] 2. Create AI config and environment validation
  - [x] 2.1 Extend `src/lib/env.ts` with optional `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GEMINI_MODEL` validation using Zod
    - Add `getAIEnv()` function that returns the AI env vars (or undefined if not configured)
    - Add `getAIEnvIssues()` function for diagnostics
    - _Requirements: 5.4, 5.6_
  - [x] 2.2 Create `src/lib/ai-config.ts` — centralized Vertex AI provider and model config
    - Export `getAIConfig()` that creates the Vertex AI provider via `createVertex` from `@ai-sdk/google-vertex`
    - Read `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` from env; default `GEMINI_MODEL` to `gemini-2.0-flash`
    - Export `requireAIConfig()` that throws a 503 `AppError` if required env vars are missing
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 2.3 Write property test for AI config env reading (Property 14)
    - **Property 14: AI config reads environment variables correctly**
    - **Validates: Requirements 5.2, 5.4**
    - Test file: `src/lib/ai-config.test.ts`
  - [ ]* 2.4 Write property test for missing Vertex AI env returns 503 (Property 15)
    - **Property 15: Missing Vertex AI env returns 503**
    - **Validates: Requirements 5.5**
    - Test file: `src/lib/ai-config.test.ts`

- [ ] 3. Implement selection state logic
  - [x] 3.1 Create `src/lib/selection.ts` — pure functions for selection state management
    - `toggleRow(selection: Set<string>, rowId: string): Set<string>` — add or remove a single row
    - `toggleAllRows(selection: Set<string>, visibleRowIds: string[]): Set<string>` — header checkbox logic (empty → select all, non-empty → clear)
    - `shiftClickRange(selection: Set<string>, visibleRowIds: string[], lastIndex: number, clickedIndex: number): Set<string>` — range selection
    - _Requirements: 1.3, 1.4, 1.5, 1.9_
  - [x]* 3.2 Write property test for checkbox toggle involution (Property 1)
    - **Property 1: Checkbox toggle is an involution**
    - **Validates: Requirements 1.3**
    - Test file: `src/lib/selection.test.ts`
  - [x]* 3.3 Write property test for header checkbox all-or-none (Property 2)
    - **Property 2: Header checkbox toggles all-or-none**
    - **Validates: Requirements 1.4, 1.5**
    - Test file: `src/lib/selection.test.ts`
  - [x]* 3.4 Write property test for selection count display (Property 3)
    - **Property 3: Selection count display matches state**
    - **Validates: Requirements 1.6**
    - Test file: `src/lib/selection.test.ts`
  - [x]* 3.5 Write property test for selection persistence (Property 4)
    - **Property 4: Selection persists across page/search changes**
    - **Validates: Requirements 1.7**
    - Test file: `src/lib/selection.test.ts`
  - [x]* 3.6 Write property test for shift-click range selection (Property 5)
    - **Property 5: Shift-click range selection**
    - **Validates: Requirements 1.9**
    - Test file: `src/lib/selection.test.ts`
  - [x]* 3.7 Write property test for AI Edit button enabled iff selection non-empty (Property 6)
    - **Property 6: AI Edit button enabled iff selection non-empty**
    - **Validates: Requirements 2.1**
    - Test file: `src/lib/selection.test.ts`

- [ ] 4. Add multi-select checkboxes to BlogTable
  - [x] 4.1 Modify `src/components/blog-table.tsx` to accept selection props and render checkboxes
    - Add props: `selectedRows: Set<string>`, `onToggleRow: (rowId: string) => void`, `onToggleAll: (visibleRowIds: string[]) => void`, `onShiftClick: (rowId: string) => void`
    - Render a checkbox column as the first column in the header and each row
    - Header checkbox: checked when all visible rows selected, indeterminate when some selected
    - Row checkboxes: checked based on `selectedRows` set membership
    - Visually highlight selected rows with a background color
    - Track last-clicked row index for shift-click range selection
    - _Requirements: 1.1, 1.2, 1.3, 1.8, 1.9_
  - [x] 4.2 Create `src/components/selection-toolbar.tsx`
    - Show selected count badge and "AI Edit" button (Phosphor icon)
    - "AI Edit" button enabled only when `selectedCount > 0`
    - Include a "Clear selection" action
    - _Requirements: 1.6, 2.1_
  - [x] 4.3 Wire selection state into `src/components/dashboard-table-view.tsx`
    - Add `useState<Set<string>>` for selection state
    - Pass selection props down to `BlogTable`
    - Render `SelectionToolbar` in the toolbar area when selection is non-empty
    - Emit `dashboard.rows.selected` wide event on selection change via a fetch to a logging helper or inline `logEvent` equivalent
    - Preserve selection across page/search changes (selection state is independent of `visiblePosts`)
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 5. Checkpoint — Ensure selection works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement the AI chat route
  - [x] 6.1 Create `src/app/api/ai/chat/route.ts`
    - `POST` handler using `streamText` from `ai` with the Vertex AI provider from `ai-config.ts`
    - Parse `body.data` for `selectedRows` and `fieldDefinitions` context (passed via `useChat`'s `body` option)
    - Build a system prompt that includes the selected row data and field definitions as context
    - Define a `propose_edits` tool using Vercel AI SDK `tool()` with a Zod schema for structured edit proposals (maps row IDs to field changes with `fieldName`, `currentValue`, `proposedValue`)
    - Return `streamText(...).toDataStreamResponse()`
    - Emit `ai.bulk_edit.requested` wide event on request receipt
    - Emit `ai.bulk_edit.completed` wide event on completion with row counts and duration
    - Return 503 if AI env vars are missing; 400 for invalid request body
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.14, 2.15, 2.16, 5.1, 5.2, 5.5_

- [ ] 7. Implement the AI image generation route
  - [x] 7.1 Create `src/app/api/ai/image/route.ts`
    - `POST` handler using `experimental_generateImage` from `ai` with the Vertex AI provider
    - Accept `prompt`, optional `referenceImageUrl`, and optional `context` (title, slug, bodyText)
    - Return `{ imageBase64, mimeType }` as JSON
    - Emit `ai.image_gen.requested` and `ai.image_gen.completed` wide events
    - Return 503 if AI env vars missing; 400 for missing prompt; 502 if model returns no image
    - _Requirements: 3.4, 3.5, 3.14, 5.1, 5.3, 5.5_

- [ ] 8. Build the edit proposal parser and bulk apply logic
  - [x] 8.1 Create `src/lib/ai-edit-parser.ts`
    - Export `parseEditProposals(toolInvocation)` — extracts `ProposedEdit[]` from a tool call result
    - Export `ProposedEdit` type
    - _Requirements: 2.8, 2.9_
  - [x] 8.2 Create `src/lib/ai-bulk-apply.ts`
    - Export `applyBulkEdits(edits, metadata)` — calls `PUT /api/posts/[id]` for each edit, continues on individual failures, returns `{ succeeded: string[], failed: Array<{ rowId: string, error: string }> }`
    - _Requirements: 2.10, 2.13_
  - [x]* 8.3 Write property test for edit proposal JSON round-trip (Property 8)
    - **Property 8: Edit proposal JSON round-trip parsing**
    - **Validates: Requirements 2.8**
    - Test file: `src/lib/ai-edit-parser.test.ts`
  - [x]* 8.4 Write property test for preview completeness (Property 9)
    - **Property 9: Change preview completeness**
    - **Validates: Requirements 2.9**
    - Test file: `src/lib/ai-edit-parser.test.ts`
  - [x]* 8.5 Write property test for partial failure resilience (Property 10)
    - **Property 10: Partial failure resilience in bulk apply**
    - **Validates: Requirements 2.13**
    - Test file: `src/lib/ai-bulk-apply.test.ts`

- [ ] 9. Build the AI Chat Panel UI
  - [x] 9.1 Create `src/components/edit-proposal-view.tsx`
    - Renders a diff-style preview of proposed changes per row: field name, current value → proposed value
    - Includes "Apply Changes" button that triggers `applyBulkEdits`
    - Shows per-row success/failure status after apply
    - _Requirements: 2.9, 2.10, 2.13_
  - [x] 9.2 Create `src/components/ai-chat-panel.tsx`
    - Uses shadcn/ui `Sheet` (slide-out from right)
    - Composes AI Elements: `Conversation`, `ConversationContent`, `Message`, `MessageContent`, `MessageResponse`, `PromptInput`, `PromptInputTextarea`, `PromptInputSubmit`, `Tool`, `Loader`
    - Uses `useChat` from `@ai-sdk/react` with `body` option to pass selected row data and field definitions
    - Displays selected row count and truncated titles at the top
    - Renders `EditProposalView` for `propose_edits` tool invocations
    - Shows loading indicator while streaming; disables submit during processing
    - Displays errors from `onError` callback as system messages
    - Close button dismisses panel without discarding conversation history
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.17, 2.18, 5.7_
  - [x] 9.3 Wire `AIChatPanel` into `src/components/dashboard-table-view.tsx`
    - Add `chatOpen` state, toggled by `SelectionToolbar`'s "AI Edit" button
    - Pass selected posts (full `BlogPostRecord[]`), metadata, and `onPostsUpdated` callback
    - `onPostsUpdated` merges updated posts into `cachedPosts` state
    - _Requirements: 2.1, 2.2, 2.11_
  - [ ]* 9.4 Write property test for chat panel context matches selection (Property 7)
    - **Property 7: Chat panel context matches selection**
    - **Validates: Requirements 2.3**
    - Test file: `src/components/ai-chat-panel.test.ts`

- [x] 10. Checkpoint — Ensure chat panel and bulk editing work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Build the AI image generation dialog
  - [x] 11.1 Create `src/lib/ai-image-prompt.ts`
    - Export `buildDefaultPrompt(title?: string, slug?: string): string` — generates a suggested prompt from CMS item context
    - Export `buildAltText(prompt: string): string` — derives alt text from the generation prompt
    - _Requirements: 3.3, 4.11_
  - [x]* 11.2 Write property test for image prompt pre-population (Property 11)
    - **Property 11: Image dialog pre-populates prompt from CMS item**
    - **Validates: Requirements 3.3**
    - Test file: `src/lib/ai-image-prompt.test.ts`
  - [x]* 11.3 Write property test for rich text context display (Property 12)
    - **Property 12: Rich text image dialog shows CMS context**
    - **Validates: Requirements 4.3**
    - Test file: `src/lib/ai-image-prompt.test.ts`
  - [x]* 11.4 Write property test for img alt from prompt (Property 13)
    - **Property 13: Inserted image alt text derived from prompt**
    - **Validates: Requirements 4.11**
    - Test file: `src/lib/ai-image-prompt.test.ts`
  - [x] 11.5 Create `src/components/ai-image-dialog.tsx`
    - Shared dialog for both image field and rich text inline generation
    - Text prompt input, optional reference image URL input
    - Pre-populates prompt via `buildDefaultPrompt` when `context` is provided
    - Displays CMS item context (title, slug, body) as reference when provided
    - Sends POST to `/api/ai/image` with prompt, referenceImageUrl, and context
    - Shows generated image preview with "Accept"/"Regenerate"/"Cancel" buttons
    - Loading state disables action buttons during generation
    - Error display with retry option
    - On accept: converts base64 to File, uploads via `POST /api/uploads`, calls `onAccept(imageUrl, altText)`
    - Uses Phosphor icons
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.12, 4.13, 4.14_

- [ ] 12. Integrate AI image generation into the Post Editor
  - [x] 12.1 Add "Generate Image" button to image fields in `src/components/post-editor.tsx`
    - Render a "Generate Image" button (Phosphor icon) next to the existing upload control for `image` type fields
    - On click, open `AIImageDialog` with `defaultPrompt` built from the current title and slug
    - On accept, set the returned URL as the image field value via `form.setValue`
    - Emit `ai.image_gen.requested` / `ai.image_gen.completed` wide events from the `/api/ai/image` route (already handled in task 7)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.12, 3.13_
  - [x] 12.2 Add "Generate Image" toolbar button to the `RichTextInput` in `src/components/post-editor.tsx`
    - Add a Phosphor icon button to the rich text toolbar
    - On click, open `AIImageDialog` with full CMS item context (title, slug, body text)
    - On accept: upload image via `/api/uploads`, insert `<img>` element at cursor position (or append at end if no cursor)
    - Set `alt` attribute from `buildAltText(prompt)`
    - Emit inline-specific wide events from the `/api/ai/image` route
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All AI model calls are mocked in tests — no real Gemini API calls during testing
- Never modify `.env` files directly — task 1 tells the user what to add
- Uses Phosphor icons for all new UI elements
- Uses shadcn/ui Sheet for the chat panel slide-out
- AI Elements components are installed as source files, not npm packages
