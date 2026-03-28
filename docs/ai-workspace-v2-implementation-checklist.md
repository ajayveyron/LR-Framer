# AI Workspace V2 Implementation Checklist

## Purpose

This checklist translates the V2 AI workspace plan into an implementation order that future agents can follow incrementally.

Reference plan:

- [`docs/ai-workspace-v2-plan.md`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/docs/ai-workspace-v2-plan.md)

## Phase 0: Guardrails

- Read [`src/components/ai-chat-panel.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/ai-chat-panel.tsx) before changing anything.
- Read [`src/app/api/ai/chat/route.ts`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/app/api/ai/chat/route.ts) before changing message-part assumptions.
- Preserve user-confirmation requirements for CMS mutations.
- Do not run `npm run build`.

## Phase 1: Split-Pane Container

### Objective

Introduce a docked, hidable, resizable AI workspace pane in the dashboard layout.

### Tasks

- Identify the dashboard layout component that should own the split-pane container.
- Replace the current drawer-first mounting model with a pane-first model.
- Persist pane open/closed state locally.
- Persist pane width locally.
- Add a collapse/reopen affordance.
- Keep the existing chat internals temporarily if that reduces migration risk.

### Verification

- `npm run typecheck`

## Phase 2: Session and Workspace Hooks

### Objective

Extract state ownership out of the render tree.

### Tasks

- Create `useAIWorkspaceState` for pane UI state.
- Create `useAIChatSession` for `useChat` ownership.
- Move restore/new chat behavior into the session hook.
- Move approval response behavior into the session hook.
- Simplify local persistence to workspace state plus active thread identity.

### Verification

- `npm run typecheck`
- `npm run test` if hook logic is extracted into testable utilities

## Phase 3: Conversation Rendering Split

### Objective

Remove monolithic message rendering from the main AI container.

### Tasks

- Create `AIConversationView`.
- Create `AIMessagePartRenderer`.
- Create `AIToolPartRenderer`.
- Render message parts in a consistent order:
  - reasoning
  - tool activity
  - review or approval state
  - final text response
  - sources
- Keep Framer/CMS-specific rich tool renderers working.

### Verification

- `npm run typecheck`
- `npm run lint`

## Phase 4: Inline Token Composer

### Objective

Replace selected-row-specific chip handling with a reusable inline token input.

### Tasks

- Review [`src/components/chip-input.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/chip-input.tsx) and decide whether to generalize or replace it.
- Build `InlineTokenInput`.
- Support a selected-row token type first.
- Add hover-to-clear affordance.
- Preserve submit, paste, and attachment behavior.
- Keep the field flexible enough for future token types:
  - row
  - command
  - skill
  - attachment

### Verification

- `npm run typecheck`
- `npm run lint`

## Phase 5: Review Mode

### Objective

Replace the nested preview drawer with an in-pane review experience.

### Tasks

- Create `AIReviewWorkspace`.
- Define review state shape:
  - proposal
  - affected items
  - active item index
  - current tab
- Support:
  - change summary
  - preview
  - approve
  - reject
  - ask AI to revise
- Preserve the useful parts of [`src/components/cms-action-confirmation.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/cms-action-confirmation.tsx) instead of rewriting validation logic from scratch.

### Verification

- `npm run typecheck`
- `npm run lint`

## Phase 6: History Mode

### Objective

Keep history durable, but simplify the UI architecture around it.

### Tasks

- Reframe history as a pane mode, not a separate takeover architecture.
- Reuse or adapt [`src/components/chat-history-panel.tsx`](/Users/ajaypawriya/Desktop/Projects/LR-Framer/src/components/chat-history-panel.tsx).
- Keep restore/delete behavior intact.
- Ensure history survives reloads through existing server-backed storage.

### Verification

- `npm run typecheck`

## Phase 7: Cleanup

### Objective

Remove obsolete panel assumptions and reduce user-facing noise.

### Tasks

- Remove `Sheet`-specific AI behavior once the pane is stable.
- Remove nested drawer assumptions.
- Move stream debug behavior behind development-only rendering, or delete it if no longer useful.
- Delete dead code paths after the replacement is fully wired.

### Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test` where applicable

## Suggested First Pass Scope

If the work is split across multiple sessions, the safest first implementation pass is:

1. Introduce the split-pane shell.
2. Keep the existing AI internals mounted inside it.
3. Extract session state into hooks.
4. Land the message renderer split.

This reduces UX risk while avoiding a full rewrite in one change.

## Suggested Second Pass Scope

After the shell and state are stable:

1. Replace the composer with inline tokens.
2. Replace the preview drawer with review mode.
3. Simplify history mode.

## Things Future Agents Should Not Accidentally Break

- approval-required mutation flow
- org-scoped access behavior
- selected-row context sent to chat requests
- history persistence
- quota gating
- Framer-specific tool rendering

## Open Product Questions

These do not block the structural refactor, but they may affect the review UI:

- For edited items, should the default review tab be `Changes` or `Preview`?
- Should the collapsed AI pane reopen to the last-used mode or always return to `Chat`?
- Should unsent draft text persist across reloads, or should only committed thread state persist?
