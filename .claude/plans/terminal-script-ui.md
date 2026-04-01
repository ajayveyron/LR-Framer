# Terminal-style Script UI

## Goal
Replace the current card-in-card `BulkScriptConfirmation` with a single unified terminal panel where code and output share one continuous monospace surface.

## Current problems
1. Script code and logs are two separate bordered boxes nested inside a `ToolCallRow` card — 3 layers of nesting
2. Description, collection badge, code, logs, duration, error panel, buttons are all separate disconnected sections
3. No visual connection between "this code ran" and "these logs came from it"
4. The shimmer animation on the header doesn't convey "executing" well

## Design

```
┌─────────────────────────────────────────────────┐
│  ▸ Run script              NEEDS APPROVAL       │  ← minimal header row
│    "Set all draft posts to published"            │  ← description as subtitle
├─────────────────────────────────────────────────┤
│  1 │ const items = await framer.getItems(...)    │
│  2 │ for (const item of items) {                 │  ← syntax-highlighted code
│  3 │   await framer.update(item.id, ...)         │     with line numbers
│  4 │ }                                           │
│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│  ← dashed divider (only after run)
│  [LOG] Processing item 1/24...                   │
│  [LOG] Updated "My Post"                         │  ← logs stream in monospace
│  [ERR] Failed to update "Bad Post" - 404         │  ← errors in red inline
│                                                  │
│  ✓ Completed in 2.3s                             │  ← result line
├─────────────────────────────────────────────────┤
│       [ Approve & Run ]    [ Reject ]            │  ← action buttons (pending only)
└─────────────────────────────────────────────────┘
```

## States

| State | Code area | Divider | Log area | Footer |
|-------|-----------|---------|----------|--------|
| **pending** | Full opacity, syntax highlighted | Hidden | Hidden | Approve/Reject buttons |
| **executing** | Slightly dimmed (opacity-60) | Dashed line visible | Logs streaming + blinking cursor | Hidden |
| **approved** (success) | Dimmed (opacity-50) | Dashed line | Full logs + green "Completed in Xs" | Hidden |
| **failed** | Dimmed (opacity-50) | Dashed line | Logs + red error inline | Hidden |
| **rejected** | Dimmed, strikethrough-ish | Hidden | Hidden | "Not executed" text |

## Files to change

### 1. `src/components/bulk-script-confirmation.tsx` — Full rewrite
- Remove `ToolCallRow` wrapper entirely
- Build a self-contained terminal panel component
- Single outer div with dark-ish terminal background (`bg-[#1e1e1e]` or use the existing `fresco-surface-muted` dark variant)
- **Header**: icon + "Run script" + status badge + description underneath
- **Code section**: Reuse `CodeBlockContent` from code-block.tsx for syntax highlighting (just the body, no container/border)
- **Divider**: dashed border, only rendered when logs exist or state is executing
- **Log section**: monospace `<pre>` with colored log lines (same as current `LogOutput` but no separate box)
- **Result footer**: inline at bottom of log area — checkmark + duration or error
- **Action buttons**: below the terminal panel for pending state
- Keep the same props interface (`BulkScriptConfirmationProps`) so no changes needed in parent

### 2. `src/components/ai-message-part-renderer.tsx` — No changes needed
The parent already passes `proposal`, `state`, `output`, `onApprove`, `onReject` — the interface stays the same.

## Implementation details

- Use the existing `CodeBlockContent` component for syntax-highlighted code (it handles shiki async loading gracefully)
- Terminal background: use a slightly darker surface tone to differentiate from the chat — `bg-fresco-surface-muted` with a dark overlay or a specific class
- Logs auto-scroll to bottom when streaming (useRef + scrollIntoView)
- Keep the existing `deriveVisualState` logic
- The blinking cursor during execution: a simple `animate-pulse` on a `▋` character at the end of logs
