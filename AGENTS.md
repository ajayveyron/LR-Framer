# AGENTS.md

## Purpose

This repo is an internal Next.js dashboard for managing one unmanaged Framer CMS collection. It also includes an optional Notion-to-Framer sync bridge.

Agents working here should optimize for safe, incremental changes and avoid breaking the Framer data flow.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- `framer-api` for Framer CMS access
- Zod for env validation and schema checks

## Key Commands

- `npm run dev` starts local development
- `npm run lint` runs ESLint
- `npm run typecheck` runs TypeScript checks
- `npm run framer:check` validates the Framer connection using `.env`

## Working Rules

- Do not run `npm run build` unless the user explicitly asks.
- Prefer `npm run typecheck` and `npm run lint` for validation after code changes.
- Only run `npm run framer:check` when the task touches Framer behavior and the required env vars are present.
- Do not commit or revert unrelated user changes.
- Keep edits small and localized. This project is straightforward; avoid unnecessary abstractions.

## Project Map

- `src/app/(dashboard)` contains the dashboard pages and layout
- `src/app/api` contains route handlers for posts, metadata, Notion webhook, and manual sync
- `src/components` contains dashboard UI and editor-related components
- `src/lib/env.ts` validates Framer and optional Notion env configuration
- `src/lib/framer.ts` and `src/lib/framer-core.ts` hold Framer collection access and mapping logic
- `src/lib/notion.ts` handles Notion bridge behavior
- `scripts/check-framer.mjs` is the manual Framer connectivity check

## External Services

### Framer

Core env vars:

- `FRAMER_PROJECT_URL`
- `FRAMER_API_KEY`
- `FRAMER_COLLECTION_NAME` with default `Blog`

Important behavior:

- The app works against one configured collection.
- Create flows should keep creating drafts unless the user requests a behavior change.
- Update flows currently publish edited posts automatically. Treat that as intentional behavior unless asked to change it.

### Notion Bridge

The Notion integration is optional. If `NOTION_*` vars are not configured, the dashboard should still work normally.

When changing Notion sync behavior:

- preserve the current fallback behavior for syncing approved pages
- keep `NOTION_FIELD_MAP` support intact
- avoid requiring Notion config for non-Notion dashboard work

## Editing Guidance

- Follow the existing App Router structure instead of introducing a new architecture.
- Reuse helpers in `src/lib` before adding duplicate request or mapping logic.
- Keep env validation centralized in `src/lib/env.ts`.
- If changing Framer field mapping or item payloads, consider both manual dashboard edits and Notion-triggered syncs.
- Do not add delete behavior for CMS items unless the user explicitly asks for it.

## Verification Guidance

Use the smallest relevant verification set:

- UI or route changes: `npm run typecheck`
- Lint-sensitive changes: `npm run lint`
- Framer integration changes: `npm run framer:check` if env is configured

If verification cannot run because env vars or network access are unavailable, state that clearly.
