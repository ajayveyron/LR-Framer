# AI Workspace V2 Plan

## Summary

This document defines the target redesign for the dashboard AI experience.

The current AI surface is implemented primarily in [`src/components/ai-chat-panel.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/ai-chat-panel.tsx). It currently combines:

- container chrome
- `useChat` transport orchestration
- local persistence
- stream debug state
- tool activity rendering
- approval handling
- preview drawer behavior
- quota gating
- composer behavior
- message rendering

That coupling is the main reason the AI panel feels brittle.

V2 replaces the overlay drawer model with a docked, hidable, resizable split-pane AI workspace inside the dashboard layout. It keeps the useful product-specific behaviors, but rebuilds the surface around smaller components and stock AI Elements patterns where possible.

## Confirmed Product Decisions

These decisions were made during planning and should be treated as the default product direction unless explicitly changed later.

- AI should not be an overlay side drawer.
- AI should live in a split-pane dashboard layout.
- The pane should be hidable.
- The pane should be resizable.
- User-visible reasoning should exist and remain visible.
- Chat history is required.
- Session behavior can be simplified, but history cannot be removed.
- Selected rows should remain inline in the composer.
- The composer should support a specific inline chip/token component with hover-to-clear behavior.
- The inline chip/token system should be reusable later for selected rows, commands, skills, and other attachable entities.
- The current preview drawer experience is open for redesign.

## Goals

- Replace the AI drawer with a docked split-pane workspace.
- Reduce the AI UI into smaller units with clearer ownership.
- Keep history reliable across reloads.
- Preserve selected-row context in the composer, but make it a reusable primitive.
- Keep visible reasoning, but present it in a controlled way.
- Make AI review and approval flows feel native to chat instead of bolted on.
- Reuse stock AI Elements primitives where they fit.

## Non-Goals

- Do not rewrite the backend chat protocol in phase 1 unless the UI requires it.
- Do not redesign the whole AI system prompt during the container refactor.
- Do not remove product-specific Framer/CMS affordances in the name of genericity.
- Do not run `npm run build` as part of this work.

## Current State

### Main files involved today

- [`src/components/ai-chat-panel.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/ai-chat-panel.tsx)
- [`src/components/ai-elements/conversation.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/ai-elements/conversation.tsx)
- [`src/components/ai-elements/message.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/ai-elements/message.tsx)
- [`src/components/ai-elements/prompt-input.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/ai-elements/prompt-input.tsx)
- [`src/components/cms-action-confirmation.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/cms-action-confirmation.tsx)
- [`src/components/chat-history-panel.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/chat-history-panel.tsx)
- [`src/app/api/ai/chat/route.ts`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/app/api/ai/chat/route.ts)

### Main problems in the current UX

- The AI surface is modal/overlay-oriented instead of workspace-oriented.
- The preview drawer is nested inside another AI container, which creates awkward visibility and interaction rules.
- Too many independent concerns are held in one file and one render tree.
- Tool state, approval state, and conversation state are too tightly coupled.
- Selected-row chips are useful, but the implementation is narrow and hard to reuse.
- Stream debug and timing behavior are too close to user-facing UI.

## Target UX Model

AI becomes a persistent right-side workspace pane inside the dashboard.

### Layout

- Main dashboard content remains on the left.
- AI workspace lives in a right-side pane.
- The pane is:
  - resizable
  - collapsible
  - persistent across normal dashboard use
  - restored on reload using lightweight local state

### Pane Modes

The pane should support three top-level modes:

- `chat`
- `review`
- `history`

Recommended behavior:

- Default to `chat`.
- Switch to `review` when a proposal needs focused user review.
- Switch to `history` from a header control rather than fully replacing the entire AI system with another screen architecture.

### Reasoning

Reasoning stays visible, but should be visually subordinate to the final answer and tool actions.

Recommended behavior:

- show reasoning while streaming
- keep reasoning available after completion
- collapse reasoning by default once complete
- avoid making raw reasoning the dominant content block

### Composer

The composer should support inline tokens in the text field itself.

Initial token type:

- selected row token

Planned future token types:

- command token
- skill token
- attachment token

Token behavior:

- sits inline with text, not above the field
- supports hover affordances
- supports remove/clear action
- supports keyboard deletion
- should not be implemented as a one-off selected-row hack

### Review Flow

The current nested preview drawer should be replaced.

Recommended model:

- the assistant proposes an action in-thread
- the pane can switch into `review` mode
- review mode focuses on the proposed change set
- the user can preview, compare, approve, reject, or ask for revision

This should feel like "chat, review, apply" rather than "chat, then another unrelated editor opens".

## Architecture Direction

Use stock AI Elements patterns for generic chat surface concerns, and keep Framer/CMS-specific parts custom.

### Stock-style primitives to lean on

- conversation
- message
- prompt input
- reasoning
- tool shell
- sources
- confirmation patterns

### Product-specific custom pieces to keep

- Framer tool result renderers
- CMS action summary and validation
- async image job UI
- selected-row token behavior
- billing/quota gating
- review/preview surface for newly created or edited items

## Proposed Component Structure

The current AI implementation should be decomposed into smaller units with explicit ownership.

### Workspace shell

- `AIWorkspacePane`
- `AIWorkspaceHeader`
- `AIWorkspaceBody`

### Conversation

- `AIConversationView`
- `AIMessagePartRenderer`
- `AIToolPartRenderer`
- `AIReasoningBlock`

### Review and history

- `AIReviewWorkspace`
- `AIHistoryView`

### Composer

- `AIComposer`
- `InlineTokenInput`
- `InlineToken`

### Hooks

- `useAIWorkspaceState`
- `useAIChatSession`
- `usePersistedAIWorkspace`
- `useInlineComposerContext`
- `useReviewState`
- `useChatHistory`

## Proposed File Map

This is a suggested direction, not a hard requirement. The important part is to separate container, session state, rendering, and review behavior.

### Candidate new files

- `src/components/ai-workspace-pane.tsx`
- `src/components/ai-workspace-header.tsx`
- `src/components/ai-conversation-view.tsx`
- `src/components/ai-message-part-renderer.tsx`
- `src/components/ai-tool-part-renderer.tsx`
- `src/components/ai-review-workspace.tsx`
- `src/components/ai-history-view.tsx`
- `src/components/ai-composer.tsx`
- `src/components/inline-token-input.tsx`
- `src/components/inline-token.tsx`
- `src/lib/use-ai-chat-session.ts`
- `src/lib/use-ai-workspace-state.ts`
- `src/lib/use-review-state.ts`

### Existing files likely to be retained and narrowed

- [`src/components/cms-action-confirmation.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/cms-action-confirmation.tsx)
- [`src/components/chat-history-panel.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/chat-history-panel.tsx)
- [`src/components/ai-tool-renderers.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/ai-tool-renderers.tsx)
- [`src/components/chip-input.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/chip-input.tsx)

### Existing file likely to be retired or split heavily

- [`src/components/ai-chat-panel.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/ai-chat-panel.tsx)

## State Model

### Workspace state

The following should be lightweight and local:

- pane open or closed
- pane width
- active pane mode
- active conversation id

### Chat session state

This should move into a dedicated hook and own:

- `useChat`
- send flow
- approval responses
- stop and regenerate behavior
- assistant status
- message list

### Persistence

Simplify the current model:

- server-backed history remains the main durable record
- local storage keeps only:
  - pane width
  - pane visibility
  - last active conversation id
  - optional unsent draft text

Avoid persisting transient internal state such as:

- raw tool input stream text
- stream timing ticks
- temporary debug buffers

## Review Model

Review should be a first-class AI mode.

### Review mode should support

- action summary
- affected item list
- current item switcher
- changes tab
- preview tab
- approve
- reject
- request revision

### Recommendation for edited items

Prefer showing both:

- a change summary or field diff
- a rendered preview when feasible

### Recommendation for created items

Show:

- structured summary of what will be created
- field completeness state
- preview where possible

## Migration Phases

### Phase 1: Replace the container model

- remove the `Sheet`-based AI shell as the primary container
- introduce a split-pane dashboard layout
- keep current chat logic temporarily if needed

Outcome:

- AI no longer feels modal
- the main workspace and AI can coexist visibly

### Phase 2: Extract chat/session logic

- move `useChat`, persistence, restore, new chat, and approval wiring into hooks
- reduce the main AI UI file to composition only

Outcome:

- rendering can change without rebreaking transport/session behavior

### Phase 3: Rewrite message rendering

- create a dedicated message-part renderer
- normalize the order of reasoning, tool activity, review state, and final answer

Outcome:

- new tool types and message parts become easier to add safely

### Phase 4: Replace selected-row-only chip behavior

- build `InlineTokenInput`
- migrate selected rows into typed inline tokens

Outcome:

- the composer becomes extensible for rows, commands, skills, and future context types

### Phase 5: Replace nested preview drawer with review mode

- move preview and action review into the pane itself
- preserve useful preview behavior, but remove drawer-within-drawer interaction

Outcome:

- AI review feels coherent and chat-native

### Phase 6: Clean up and simplify

- remove user-facing stream debug noise
- keep any remaining debug behavior development-only
- delete obsolete AI panel code paths

Outcome:

- the AI surface is smaller, clearer, and easier to maintain

## Risks

- Visible reasoning can become noisy if not visually subordinated.
- Review mode can become another oversized component if it is not scoped tightly.
- Resizable pane behavior must remain stable across dashboard routes and reloads.
- Approval flows depend on current message-part assumptions and will need careful migration.
- The composer token system can become fragile if implemented as DOM-heavy custom editing without clear constraints.

## Acceptance Criteria

The V2 refactor should be considered successful when all of the following are true:

- AI is no longer primarily delivered through an overlay drawer.
- The dashboard supports a hidable, resizable AI split pane.
- History remains available and survives reloads.
- Selected rows appear as inline tokens in the composer.
- Reasoning remains visible in a controlled way.
- Reviewing AI-generated changes happens inside the AI workspace rather than through a nested preview drawer.
- Message rendering is modular enough that tool-specific UI changes do not require editing one monolithic file.

## Validation Guidance

Use the smallest relevant verification set for each implementation phase:

- layout and component refactors: `npm run typecheck`
- lint-sensitive component work: `npm run lint`
- pure logic or hook changes with tests available: `npm run test`

Do not run `npm run build` unless explicitly requested.

## Notes for Future Agents

- Preserve org-scoped access and AI approval semantics.
- Do not weaken the existing requirement that CMS mutations remain explicit and user-confirmed.
- Keep the AI pane stable while simplifying internals.
- Avoid reintroducing modal or drawer-centric UX unless product direction explicitly changes.
