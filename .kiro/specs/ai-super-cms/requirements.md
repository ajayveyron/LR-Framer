# Requirements Document

## Introduction

The AI Super CMS feature transforms the existing FramerLink CMS manager dashboard into an AI-powered content management platform. It adds four core capabilities: multi-row selection in the CMS table, a bulk AI editing chatbox that operates on selected rows, AI image generation for image asset fields in the post editor, and AI image generation within rich text content bodies. All AI features use the Vercel AI SDK with Google Vertex AI (Gemini models). The existing Framer CMS read/write pipeline, dashboard layout, and Notion bridge remain unchanged.

## Glossary

- **Dashboard_Table**: The CMS post list rendered by `BlogTable` and `DashboardTableView` at `/dashboard`, displaying rows of CMS items with columns, search, pagination, and context menus.
- **CMS_Row**: A single row in the Dashboard_Table representing one `BlogPostRecord` from the Framer CMS collection.
- **Selection_State**: A client-side set of CMS_Row IDs that the user has marked as selected via checkboxes in the Dashboard_Table.
- **AI_Chat_Panel**: A slide-out or overlay panel accessible from the dashboard header that provides a conversational interface for bulk AI editing of selected CMS_Rows.
- **AI_Agent**: A server-side Vercel AI SDK agent backed by a Gemini model via Google Vertex AI that receives selected CMS_Row data as context and executes user-requested bulk edits by calling Framer update endpoints.
- **Post_Editor**: The side-drawer form rendered by `PostEditor` for creating or editing a single CMS item, containing field inputs including image asset fields and rich text editors.
- **Image_Field**: A field of type `image` in the Framer CMS collection schema, rendered as an asset upload control in the Post_Editor.
- **Rich_Text_Editor**: The `contentEditable`-based rich text input inside the Post_Editor used for `formattedText` fields (body content).
- **AI_Image_Generator**: A server-side endpoint that uses the Vercel AI SDK with a Gemini model via Google Vertex AI to generate images from text prompts and optional reference context.
- **Wide_Event**: A structured JSON log entry emitted via `src/lib/logger.ts` following the wide events pattern, containing timestamp, level, event name, and contextual metadata.
- **Framer_API**: The `framer-api` package used to read and write CMS collection items, accessed through the existing `framer.ts` / `framer-core.ts` pipeline.

## Requirements

### Requirement 1: Multi-Select CMS Rows

**User Story:** As a dashboard user, I want to select multiple rows in the CMS table, so that I can perform bulk operations on them.

#### Acceptance Criteria

1. THE Dashboard_Table SHALL render a checkbox in the first column of each CMS_Row.
2. THE Dashboard_Table SHALL render a header checkbox that toggles selection of all visible CMS_Rows on the current page.
3. WHEN a user clicks a CMS_Row checkbox, THE Selection_State SHALL add or remove that CMS_Row ID from the selected set.
4. WHEN a user clicks the header checkbox while zero CMS_Rows are selected, THE Selection_State SHALL add all visible CMS_Row IDs on the current page.
5. WHEN a user clicks the header checkbox while one or more CMS_Rows are selected, THE Selection_State SHALL remove all CMS_Row IDs from the selected set.
6. THE Dashboard_Table SHALL display the count of selected CMS_Rows in the toolbar area when the Selection_State contains one or more IDs.
7. WHEN the user navigates to a different page or changes the search query, THE Selection_State SHALL retain previously selected CMS_Row IDs that are no longer visible.
8. THE Dashboard_Table SHALL visually distinguish selected CMS_Rows from unselected CMS_Rows using a background highlight.
9. WHEN a user holds Shift and clicks a CMS_Row checkbox, THE Selection_State SHALL select all CMS_Rows between the last individually selected CMS_Row and the clicked CMS_Row (range selection).
10. THE Dashboard_Table SHALL emit a Wide_Event with event name `dashboard.rows.selected` containing the count of selected rows whenever the Selection_State changes.

### Requirement 2: Bulk AI Editing via Chat Panel

**User Story:** As a dashboard user, I want to open a chat panel and instruct an AI agent to make bulk edits across my selected CMS items, so that I can update hundreds of items without editing each one manually.

#### Acceptance Criteria

1. THE Dashboard_Table toolbar SHALL render an "AI Edit" button that is enabled only when the Selection_State contains one or more CMS_Row IDs.
2. WHEN the user clicks the "AI Edit" button, THE AI_Chat_Panel SHALL open as a slide-out panel from the right side of the dashboard.
3. THE AI_Chat_Panel SHALL display the count and titles (truncated) of the currently selected CMS_Rows as context at the top of the panel.
4. THE AI_Chat_Panel SHALL provide a text input for the user to type natural language instructions.
5. WHEN the user submits a message, THE AI_Chat_Panel SHALL send the message along with the full field data of all selected CMS_Rows to the AI_Agent endpoint.
6. THE AI_Agent SHALL use the Vercel AI SDK `streamText` function with a Gemini model to process the user instruction and generate a structured response containing proposed field edits for each selected CMS_Row.
7. THE AI_Chat_Panel SHALL stream the AI_Agent response to the user in real time using the Vercel AI SDK `useChat` hook.
8. THE AI_Agent SHALL return proposed edits as a structured JSON object mapping each CMS_Row ID to its changed field values.
9. THE AI_Chat_Panel SHALL display a preview of proposed changes for each affected CMS_Row before applying them, showing the field name, current value, and proposed value.
10. WHEN the user confirms the proposed changes, THE AI_Chat_Panel SHALL call the existing `PUT /api/posts/[id]` endpoint for each affected CMS_Row to persist the edits via the Framer_API.
11. WHEN all edits are persisted, THE AI_Chat_Panel SHALL update the Dashboard_Table cached posts to reflect the new values without a full page reload.
12. IF the AI_Agent returns an error or the Gemini model request fails, THEN THE AI_Chat_Panel SHALL display the error message to the user and allow retrying.
13. IF a single CMS_Row update fails during bulk apply, THEN THE AI_Chat_Panel SHALL continue applying remaining edits and report which rows failed with their error messages.
14. THE AI_Chat_Panel SHALL support multi-turn conversation so the user can refine instructions based on previous AI_Agent responses.
15. THE AI_Agent endpoint SHALL emit a Wide_Event with event name `ai.bulk_edit.requested` containing the selected row count, user message length, and model name when a request is received.
16. THE AI_Agent endpoint SHALL emit a Wide_Event with event name `ai.bulk_edit.completed` containing the count of rows edited, count of rows failed, and total duration when processing completes.
17. WHILE the AI_Agent is processing a request, THE AI_Chat_Panel SHALL display a loading indicator and disable the submit button.
18. THE AI_Chat_Panel SHALL include a close button that dismisses the panel without discarding the conversation history for the current session.

### Requirement 3: AI Image Generation in Post Editor Image Fields

**User Story:** As a content editor, I want to generate AI images directly from image asset fields in the post editor, so that I can create thumbnails and hero images without leaving the CMS.

#### Acceptance Criteria

1. WHEN the Post_Editor renders an Image_Field, THE Post_Editor SHALL display a "Generate Image" button alongside the existing upload control.
2. WHEN the user clicks the "Generate Image" button, THE Post_Editor SHALL open a dialog containing a text prompt input and a "Generate" action button.
3. THE image generation dialog SHALL pre-populate a suggested prompt based on the current CMS item title and slug values.
4. WHEN the user submits the prompt, THE Post_Editor SHALL send the prompt to the AI_Image_Generator endpoint.
5. THE AI_Image_Generator SHALL use the Vercel AI SDK with a Gemini model to generate an image from the provided text prompt.
6. WHEN the AI_Image_Generator returns a generated image, THE Post_Editor SHALL display a preview of the generated image in the dialog.
7. THE image generation dialog SHALL provide "Accept" and "Regenerate" buttons below the preview image.
8. WHEN the user clicks "Accept", THE Post_Editor SHALL upload the generated image to the Framer_API via the existing `POST /api/uploads` endpoint and set the returned URL as the Image_Field value.
9. WHEN the user clicks "Regenerate", THE Post_Editor SHALL send the same or an edited prompt to the AI_Image_Generator to produce a new image.
10. IF the AI_Image_Generator request fails, THEN THE Post_Editor SHALL display the error message in the dialog and allow the user to retry or dismiss.
11. WHILE the AI_Image_Generator is processing, THE image generation dialog SHALL display a loading state and disable the "Generate" and "Regenerate" buttons.
12. THE AI_Image_Generator endpoint SHALL emit a Wide_Event with event name `ai.image_gen.requested` containing the prompt length, source field ID, and model name.
13. THE AI_Image_Generator endpoint SHALL emit a Wide_Event with event name `ai.image_gen.completed` containing the generation duration and success status.
14. THE AI_Image_Generator endpoint SHALL accept an optional `referenceImageUrl` parameter to provide visual context to the Gemini model.

### Requirement 4: AI Image Generation in Rich Text Content

**User Story:** As a content editor, I want to generate AI images within the rich text body of a CMS item and insert them inline, so that I can enrich article content with contextual visuals.

#### Acceptance Criteria

1. THE Rich_Text_Editor toolbar SHALL include a "Generate Image" button using a Phosphor icon.
2. WHEN the user clicks the "Generate Image" toolbar button, THE Rich_Text_Editor SHALL open a dialog for AI image generation.
3. THE image generation dialog SHALL display the current CMS item content (title, slug, and body text) as reference context that the AI_Image_Generator can use.
4. THE image generation dialog SHALL provide a text prompt input that the user can optionally fill in to guide the generation.
5. THE image generation dialog SHALL provide an optional image URL input or file picker for the user to supply a reference image.
6. WHEN the user submits the generation request, THE Rich_Text_Editor SHALL send the prompt, CMS item context, and optional reference image to the AI_Image_Generator endpoint.
7. THE AI_Image_Generator SHALL use the full CMS item context along with the user prompt to generate a contextually relevant image.
8. WHEN the AI_Image_Generator returns a generated image, THE dialog SHALL display a preview with "Insert", "Regenerate", and "Cancel" buttons.
9. WHEN the user clicks "Insert", THE Rich_Text_Editor SHALL upload the generated image via `POST /api/uploads` and insert an `<img>` element at the current cursor position in the rich text content.
10. IF no cursor position exists in the Rich_Text_Editor, THEN THE Rich_Text_Editor SHALL append the `<img>` element at the end of the content.
11. THE inserted `<img>` element SHALL include an `alt` attribute derived from the generation prompt text.
12. WHEN the user clicks "Regenerate", THE dialog SHALL send the same or edited prompt to produce a new image.
13. IF the generation or upload fails, THEN THE dialog SHALL display the error message and allow retrying.
14. WHILE the AI_Image_Generator is processing, THE dialog SHALL display a loading state and disable action buttons.
15. THE AI_Image_Generator endpoint SHALL emit a Wide_Event with event name `ai.image_gen.inline.requested` containing the prompt length, content length, and whether a reference image was provided.
16. THE AI_Image_Generator endpoint SHALL emit a Wide_Event with event name `ai.image_gen.inline.completed` containing the generation duration and success status.

### Requirement 5: AI SDK Integration and Configuration

**User Story:** As a platform operator, I want all AI features to use the Vercel AI SDK with Gemini models through a centralized configuration, so that model selection and API keys are managed in one place.

#### Acceptance Criteria

1. THE AI_Agent and AI_Image_Generator SHALL use the Vercel AI SDK (`ai` and `@ai-sdk/google-vertex` packages) for all model interactions via Google Vertex AI.
2. THE AI_Agent SHALL use a Gemini model (configurable via environment variable `GEMINI_MODEL`) for text generation and structured output.
3. THE AI_Image_Generator SHALL use a Gemini model via Vertex AI for image generation, not Imagen.
4. THE system SHALL read the Google Cloud project ID from `GOOGLE_CLOUD_PROJECT` and the Vertex AI location from `GOOGLE_CLOUD_LOCATION` environment variables for Vertex AI authentication.
5. IF the required Vertex AI environment variables (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`) are missing or empty, THEN THE AI_Agent and AI_Image_Generator endpoints SHALL return a 503 status with a descriptive error message.
6. THE system SHALL validate AI-related environment variables through the existing centralized `src/lib/env.ts` validation module.
7. THE AI_Chat_Panel and image generation dialogs SHALL use the Vercel AI SDK `useChat` and related React hooks from the `@ai-sdk/react` package for client-server streaming.
8. THE system SHALL not store conversation history or generated images beyond the current browser session.
