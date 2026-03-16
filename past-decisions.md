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
