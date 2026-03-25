# Requirements Document

## Introduction

AI Agent V2 is a comprehensive upgrade to the FramerBot AI chat assistant. The current agent (V1) works but has accumulated performance bottlenecks, prompt contradictions, missing validation, no user feedback loop, and a rigid UI layout. V2 addresses these across four phases: Speed & Reliability, Quality Loop & Metrics, Intelligence Upgrades, and Feature Expansion. The goal is a faster, smarter, more observable agent that feels like a native part of the CMS workflow rather than a bolted-on chat overlay.

## Glossary

- **Agent**: The AI chat assistant powered by Vercel AI SDK and Google Vertex AI (Gemini models) that lives in the FramerBot dashboard.
- **System_Prompt**: The dynamically constructed instruction text sent to the Gemini model on every chat turn, containing collection context, selected rows, field definitions, user memories, and behavioral rules.
- **Context_Snapshot**: A cached server-side object (`AIContextSnapshot`) containing project info, all collections, their fields, and enum cases, built by `ai-context-snapshot.ts` with a 5-minute TTL.
- **Chat_Panel**: The side-sheet UI component (`ai-chat-panel.tsx`) where users interact with the Agent.
- **Edit_Proposal**: A structured set of field-level changes proposed by the Agent via the `propose_edits` tool, rendered in `EditProposalView` for user approval.
- **CMS_Action**: A mutation operation (add, remove, update items, enum cases, or publish) proposed via `propose_cms_action` and requiring user confirmation before execution.
- **Intent_Router**: A lightweight classifier that categorizes user requests before the main Agent processes them, enabling route-specific prompt trimming and tool selection.
- **Feedback_Event**: A thumbs-up or thumbs-down signal attached to a specific message in a conversation, persisted to Convex for quality analysis.
- **Agent_Metric**: A structured wide event capturing performance and behavioral data (time-to-first-token, tool calls per task, approval rate, etc.).
- **Suggestion_Chip**: A clickable prompt shortcut shown in the chat UI, either static or dynamically derived from collection state and conversation context.
- **Docked_Panel**: A resizable chat panel anchored to the bottom or side of the dashboard that allows simultaneous table and chat interaction, replacing the current Sheet overlay.
- **Inline_AI**: Selection-based AI actions (shorten, expand, rephrase, continue) available in the post editor's rich text field.
- **Field_Definition**: A schema entry describing a CMS collection field (id, name, type, required status), used for validation.
- **Wide_Event**: A structured JSON log entry following the wide events pattern, containing all relevant context in a single record for observability.

## Requirements

### Requirement 1: Pre-warm Context Snapshot

**User Story:** As a dashboard user, I want the AI chat to already know my project context when I open it, so that I do not have to wait for a visible `get_project_context` tool call on every new conversation.

#### Acceptance Criteria

1. WHEN a new chat conversation starts, THE System_Prompt SHALL include the pre-loaded Context_Snapshot data (project info, collections, fields, enum cases) inline, using the existing 5-minute server-side cache in `ai-context-snapshot.ts`.
2. WHEN the Context_Snapshot is successfully injected into the System_Prompt, THE Chat_Panel SHALL display a passive "Context loaded" status chip instead of rendering a `get_project_context` tool call block.
3. IF the Context_Snapshot cache is empty or expired at request time, THEN THE Chat_Route SHALL fetch a fresh snapshot server-side before streaming the first response, without requiring the Agent to call `get_project_context` as a tool.
4. WHEN the Context_Snapshot is injected, THE System_Prompt SHALL remove the "FIRST TURN RULE" instruction block that currently tells the Agent to call `get_project_context` on its first response.
5. THE `get_project_context` tool SHALL remain available for the Agent to call explicitly when it needs to refresh context after a mutation.

### Requirement 2: Shrink System Prompt — Selected Row Summarization

**User Story:** As a developer, I want the system prompt to stay compact even when many rows are selected, so that token usage stays low and the model has more headroom for reasoning.

#### Acceptance Criteria

1. WHILE 3 or more rows are selected, THE System_Prompt builder SHALL summarize selected rows to include only title, ID, and slug for each row, omitting full field values.
2. WHILE fewer than 3 rows are selected, THE System_Prompt builder SHALL include full field values for each selected row (current behavior).
3. WHEN rows are summarized, THE System_Prompt SHALL include a note telling the Agent that full field data is available via `framer_get_collection_items` if needed for the task.
4. THE System_Prompt builder SHALL log a Wide_Event with the selected row count, summarization mode (full or summary), and resulting prompt section character count.

### Requirement 3: Shrink System Prompt — Conditional Section Injection

**User Story:** As a developer, I want system prompt sections to be injected only when relevant, so that simple queries do not carry thousands of tokens of unused instructions.

#### Acceptance Criteria

1. THE System_Prompt builder SHALL split the current monolithic prompt into named sections: core identity, collection context, selected rows, memory, image generation rules, alt text rules, new item creation rules, efficiency rules, presentation rules, security rules, and tool descriptions.
2. THE System_Prompt builder SHALL always inject core identity, collection context, selected rows, memory, efficiency rules, presentation rules, security rules, and tool descriptions.
3. THE System_Prompt builder SHALL inject image generation rules and alt text rules only when the active collection contains at least one image-type field.
4. THE System_Prompt builder SHALL inject new item creation rules only when no rows are selected (indicating the user may want to create content rather than edit existing rows).
5. THE System_Prompt builder SHALL log a Wide_Event listing which sections were included and the total system prompt token estimate for each chat request.

### Requirement 4: Fix Prompt Contradictions

**User Story:** As a developer, I want the system prompt to contain no contradictory instructions, so that the model does not get confused about which mutation path to use.

#### Acceptance Criteria

1. THE System_Prompt SHALL not contain any direct references to `framer_set_item_attributes` as a tool the Agent should call after image generation; all mutation instructions SHALL route through `propose_cms_action`.
2. THE System_Prompt SHALL contain a single, unambiguous mutation rule stating that ALL write operations (including setting image field values after generation) MUST use `propose_cms_action`.
3. THE image generation instruction block SHALL tell the Agent to use `propose_cms_action` with action `set_item_attributes` to apply generated image URLs to CMS fields, replacing the current instruction to chain with `framer_set_item_attributes`.

### Requirement 5: Validate Edit Proposals Against Field Definitions

**User Story:** As a dashboard user, I want invalid edit proposals to be caught before I see them, so that I do not approve changes that silently fail.

#### Acceptance Criteria

1. WHEN the `propose_edits` tool returns a result, THE Edit_Parser SHALL validate each proposed field ID against the known Field_Definitions for the active collection.
2. IF a proposed edit contains a field ID that does not exist in the active collection's Field_Definitions, THEN THE Edit_Parser SHALL flag that field as invalid and exclude it from the renderable edit set.
3. IF a proposed edit contains a value whose type does not match the expected field type (e.g., a string value for a boolean field, or a plain string for an image field expecting `{ type: "image", value: url }`), THEN THE Edit_Parser SHALL flag that field as a type mismatch.
4. WHEN one or more fields in an edit proposal are flagged as invalid or mismatched, THE EditProposalView SHALL display a visible error chip per invalid field, showing the field ID and the reason (unknown field or type mismatch).
5. WHEN all fields in a single row's edit are invalid, THE EditProposalView SHALL display that row as entirely invalid and exclude it from the "Apply" action.
6. THE Edit_Parser SHALL log a Wide_Event for each validation run, including the count of valid fields, invalid field IDs, and type mismatches.

### Requirement 6: Validate CMS Action Proposals

**User Story:** As a dashboard user, I want CMS action proposals to be validated before I see the confirmation card, so that approving an action does not result in a silent Framer API error.

#### Acceptance Criteria

1. WHEN the `propose_cms_action` tool returns a result with action `set_item_attributes`, THE CMS_Action validator SHALL verify that all field IDs in the `fieldData` payload exist in the target collection's Field_Definitions.
2. WHEN the `propose_cms_action` tool returns a result with action `add_items`, THE CMS_Action validator SHALL verify that all field IDs in each item's `fieldData` payload exist in the target collection's Field_Definitions.
3. IF validation finds unknown field IDs or type mismatches, THEN THE CmsActionConfirmation component SHALL display a warning banner listing the invalid fields, and the Approve button SHALL remain enabled with a "Proceed anyway" label.
4. THE CMS_Action validator SHALL log a Wide_Event for each validation run with the action type, valid field count, and invalid field details.

### Requirement 7: Message Feedback (Thumbs Up/Down + Copy)

**User Story:** As a dashboard user, I want to give quick feedback on AI responses and copy useful answers, so that the team can track quality and I can reuse good outputs.

#### Acceptance Criteria

1. THE Chat_Panel SHALL display a thumbs-up button and a thumbs-down button on every assistant message, visible on hover or focus.
2. WHEN the user clicks a thumbs-up or thumbs-down button, THE Chat_Panel SHALL persist a Feedback_Event to Convex containing the conversation ID, message ID, feedback value (positive or negative), and a timestamp.
3. WHEN a feedback button is clicked, THE Chat_Panel SHALL visually indicate the selected feedback state (filled icon) and disable the opposite button for that message.
4. THE Chat_Panel SHALL display a copy-to-clipboard button on every assistant message that contains text content, visible on hover or focus.
5. WHEN the user clicks the copy button, THE Chat_Panel SHALL copy the assistant message's text content (markdown source) to the system clipboard and show a brief "Copied" confirmation.
6. IF the Convex mutation for persisting feedback fails, THEN THE Chat_Panel SHALL swallow the error silently and log a Wide_Event with the failure details, without disrupting the chat experience.

### Requirement 8: Agent Metrics via Wide Events

**User Story:** As a developer, I want structured metrics for every agent interaction, so that I can analyze performance, cost, and user behavior patterns.

#### Acceptance Criteria

1. WHEN a chat stream completes, THE Chat_Route SHALL log a Wide_Event containing: conversation ID, turn number, time-to-first-token (measured server-side from request start to first stream chunk), total duration, input tokens, output tokens, tool call count, tool names used, and model name.
2. WHEN a user approves or rejects an Edit_Proposal, THE Chat_Panel SHALL log a Wide_Event containing: conversation ID, message ID, action (approved or rejected), edit count, and field IDs affected.
3. WHEN a user approves or rejects a CMS_Action, THE CmsActionConfirmation component SHALL log a Wide_Event containing: conversation ID, action type, action (approved, rejected, or failed), and duration from proposal to decision.
4. WHEN a user clicks the stop button during streaming, THE Chat_Panel SHALL log a Wide_Event containing: conversation ID, message ID, and the number of tokens received before cancellation.
5. WHEN a user starts a new chat or restores a conversation from history, THE Chat_Panel SHALL log a Wide_Event containing: action (new_chat or restore), previous conversation message count, and conversation ID.

### Requirement 9: Contextual Suggestion Chips

**User Story:** As a dashboard user, I want the chat suggestions to reflect what I am actually doing in the dashboard, so that I can start useful tasks with one click.

feel free to use gemini 2.5 flash like fast gemini model to ask llm for these suggestions. 

#### Acceptance Criteria

1. WHEN no rows are selected and the chat is empty, THE Chat_Panel SHALL display suggestion chips derived from the active collection's state, including: a chip for items with missing image fields (if any exist), a chip for stale drafts older than 7 days (if any exist), and a chip for items missing alt text (if the `scanMissingAltText` insight is active).
2. WHEN rows are selected and the chat is empty, THE Chat_Panel SHALL display suggestion chips contextual to the selection, including: a chip to rewrite selected content, a chip to generate images for selected rows missing images, and a chip to audit SEO metadata for the selection.
3. WHEN the conversation has 2 or more turns, THE Chat_Panel SHALL replace the initial suggestion chips with follow-up suggestions based on the last assistant message topic (e.g., "Apply to more rows" after an edit proposal, "Generate for the next item" after image generation).
4. THE Suggestion_Chip generator SHALL accept the current collection metadata, selected posts, content nudges map, and recent message history as inputs, and return an ordered array of up to 4 suggestions.

### Requirement 10: Intent Router

**User Story:** As a developer, I want simple queries to be handled with a minimal prompt and tool set, so that latency and token cost are reduced for straightforward questions.

#### Acceptance Criteria

1. WHEN a user message is received, THE Chat_Route SHALL classify the intent into one of six categories: answer-only, inspect, edit, create, research, or publish.
2. THE Intent_Router SHALL use a lightweight classification approach (keyword matching with fallback to a short LLM call using the same Gemini model) that adds no more than 200ms of latency to the request.
3. WHEN the intent is classified as "answer-only", THE Chat_Route SHALL exclude all Framer write tools and image generation tools from the tools map, and exclude image generation rules, alt text rules, and new item creation rules from the System_Prompt.
4. WHEN the intent is classified as "inspect", THE Chat_Route SHALL include only read-only Framer tools (get_project_info, get_collections, get_collection_fields, get_collection_items, get_enum_cases) and exclude all write tools.
5. WHEN the intent is classified as "edit", THE Chat_Route SHALL include `propose_edits` and read-only Framer tools, and exclude `propose_cms_action`, image generation, and web search tools.
6. WHEN the intent is classified as "create", THE Chat_Route SHALL include `propose_cms_action`, image generation, and read-only Framer tools, and inject new item creation rules into the System_Prompt.
7. WHEN the intent is classified as "research", THE Chat_Route SHALL include `web_search` and read-only Framer tools, and exclude all write tools.
8. WHEN the intent is classified as "publish", THE Chat_Route SHALL include `propose_cms_action` (publish action only) and read-only Framer tools.
9. THE Intent_Router SHALL log a Wide_Event for each classification containing: the classified intent, classification method (keyword or LLM), classification latency, and the user message length.
10. IF the Intent_Router classification fails or times out, THEN THE Chat_Route SHALL fall back to the full tool set and full System_Prompt (current V1 behavior).

### Requirement 11: Multi-Step Planning

**User Story:** As a dashboard user, I want the agent to outline a plan before executing complex multi-step tasks, so that I can review and approve the approach before changes are made.

#### Acceptance Criteria

1. WHEN the Agent determines that a task requires 3 or more tool calls or affects 3 or more CMS items, THE Agent SHALL first output a numbered plan listing each step, and ask the user to confirm before proceeding.
2. WHEN the user confirms the plan, THE Agent SHALL execute the steps in the outlined order, narrating progress between each step.
3. WHEN the user rejects or modifies the plan, THE Agent SHALL incorporate the feedback and present a revised plan.
4. THE multi-step planning behavior SHALL be implemented as a System_Prompt addition (prompt-only change), not as a new tool or code-level enforcement.

### Requirement 12: Bulk Image Generation

**User Story:** As a dashboard user, I want the agent to generate images for multiple items in a single conversation turn, so that I do not have to send separate messages for each image.

#### Acceptance Criteria

1. THE System_Prompt SHALL remove the "one image per turn" restriction that currently limits `generate_and_upload_image` to a single call per user message.
2. WHEN the user requests images for multiple items, THE Agent SHALL first propose a batch plan listing each item and the image prompt it will use, and wait for user confirmation.
3. WHEN the user approves the batch plan, THE Agent SHALL execute image generation calls sequentially (one at a time) to respect Vertex AI rate limits.
4. IF an individual image generation fails within a batch, THEN THE Agent SHALL log the failure, skip that item, continue with the remaining items, and report the partial result to the user.
5. THE Agent SHALL enforce a maximum batch size of 10 images per user-approved plan.
6. WHEN executing a batch, THE Agent SHALL narrate progress after each image is generated (e.g., "Generated 3 of 7 images…").

### Requirement 13: Structured Output Validation for All Tool Results

**User Story:** As a developer, I want all tool outputs to be validated against known schemas before rendering, so that malformed data surfaces as clear errors instead of silent failures.

#### Acceptance Criteria

1. WHEN a Framer read tool (get_collections, get_collection_fields, get_collection_items, get_enum_cases) returns a result, THE tool result renderer SHALL validate the output shape against the expected schema before attempting rich UI rendering.
2. IF a tool result fails schema validation, THEN THE tool result renderer SHALL display a compact error chip showing the tool name and "Invalid response format" instead of crashing or showing raw JSON.
3. WHEN the `generate_and_upload_image` tool returns a result, THE tool result renderer SHALL validate that a successful result contains a non-empty `url` string before rendering the image preview.
4. THE validation layer SHALL log a Wide_Event for each validation failure containing: tool name, expected schema summary, and the actual output shape.

### Requirement 14: Docked Chat Panel

**User Story:** As a dashboard user, I want to use the AI chat and the data table at the same time, so that I can reference table data while chatting and see changes applied in real time.

#### Acceptance Criteria

1. THE Chat_Panel SHALL support a docked mode where it is anchored to the right side of the dashboard, coexisting with the table view without overlaying it.
2. WHEN the Chat_Panel is in docked mode, THE dashboard table SHALL resize to fill the remaining horizontal space, and both the table and chat SHALL be fully interactive simultaneously.
3. THE Chat_Panel SHALL support resizing its width via a drag handle on its left edge, with a minimum width of 320px and a maximum width of 50% of the viewport.
4. THE Chat_Panel SHALL persist the user's preferred width and docked/overlay mode preference in localStorage.
5. WHEN the viewport width is below 768px, THE Chat_Panel SHALL fall back to the current Sheet overlay mode regardless of the user's docked preference.
6. THE user SHALL be able to toggle between docked mode and overlay mode via a button in the Chat_Panel header.

### Requirement 15: Inline AI in Post Editor

**User Story:** As a content editor, I want to use AI actions directly on selected text in the post editor, so that I can refine content without switching to the chat panel.

#### Acceptance Criteria

1. WHEN the user selects text in the rich text editor, THE Post_Editor SHALL display a floating toolbar with AI action buttons: Shorten, Expand, Rephrase, and Continue Writing.
2. WHEN the user clicks an AI action button, THE Post_Editor SHALL send the selected text and the action type to the `/api/ai/rewrite` endpoint and display a loading indicator on the toolbar.
3. WHEN the rewrite response is received, THE Post_Editor SHALL show an inline diff view (current behavior from the existing rewrite feature) with Accept and Reject buttons.
4. WHEN the user accepts the rewrite, THE Post_Editor SHALL replace the selected text with the rewritten content and dismiss the toolbar.
5. WHEN the user rejects the rewrite, THE Post_Editor SHALL restore the original selection and dismiss the toolbar.
6. IF the rewrite request fails, THEN THE Post_Editor SHALL display a brief error message on the toolbar and allow the user to retry.
7. THE floating toolbar SHALL position itself above the text selection and reposition on scroll to stay visible within the editor viewport.
8. THE Post_Editor SHALL log a Wide_Event for each inline AI action containing: action type, input text length, output text length, accepted or rejected, and duration.

### Requirement 16: Collection Schema Mutation Tools

**User Story:** As a power user, I want the AI agent to be able to create or modify collection fields on my behalf, so that I can evolve my CMS schema through natural language.

#### Acceptance Criteria

1. WHERE the Framer Server API supports field creation and modification, THE Agent SHALL have access to `propose_cms_action` with new action types: `add_field` and `update_field`.
2. WHEN the user asks the Agent to add a new field to a collection, THE Agent SHALL propose a CMS_Action with action `add_field` containing the collection ID, field name, field type, and required status.
3. WHEN the user asks the Agent to modify an existing field (rename or change required status), THE Agent SHALL propose a CMS_Action with action `update_field` containing the collection ID, field ID, and the attributes to change.
4. THE CmsActionConfirmation component SHALL render schema mutation proposals with a distinct visual treatment (different icon and "Schema change" label) to differentiate them from data mutations.
5. IF the Framer Server API does not support field creation or modification, THEN THE Agent SHALL inform the user that schema changes are not supported by the current Framer API and suggest making the change directly in the Framer editor.
