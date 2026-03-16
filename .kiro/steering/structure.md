# Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (dark mode, fonts)
│   ├── globals.css             # CSS custom properties + Tailwind
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard shell (env check, data preload)
│   │   ├── page.tsx            # Dashboard index (renders null, layout owns UI)
│   │   └── posts/
│   │       ├── [id]/page.tsx   # Edit post page
│   │       └── new/page.tsx    # Create post page
│   └── api/
│       ├── posts/              # CRUD route handlers (GET, POST, PATCH)
│       ├── meta/fields/        # Collection field metadata
│       ├── notion/             # Webhook, sync, import endpoints
│       └── uploads/            # Asset upload proxy
├── components/
│   ├── ui/                     # shadcn primitives (button, dialog, input, etc.)
│   ├── blog-table.tsx          # Post list table
│   ├── post-editor.tsx         # Post create/edit form
│   ├── dashboard-table-view.tsx
│   ├── column-controls.tsx
│   ├── config-required-state.tsx
│   ├── notification-provider.tsx
│   └── notion-bridge-state.tsx
├── lib/
│   ├── env.ts                  # Centralized env validation (Zod)
│   ├── framer.ts               # Framer RPC client (spawns child process)
│   ├── framer-core.ts          # Framer collection logic (runs in child process)
│   ├── notion.ts               # Notion bridge: sync, webhook, import, write-back
│   ├── notion-payload.ts       # Notion webhook payload parsing
│   ├── cms-types.ts            # Shared CMS type definitions
│   ├── post-schema.ts          # Zod schemas for post input validation
│   ├── post-route-logic.ts     # Route handler business logic (DI-friendly)
│   ├── post-route-handlers.ts  # Wires route logic to real Framer functions
│   ├── dashboard-columns.ts    # Default column config for table view
│   ├── api.ts                  # Error response helpers for route handlers
│   ├── errors.ts               # AppError class
│   ├── logger.ts               # Structured JSON logger (wide events)
│   └── utils.ts                # cn() helper (clsx + tailwind-merge)
scripts/
├── check-framer.mjs            # CLI connectivity check
└── framer-rpc.mjs              # Child-process RPC entry point for framer-core
```

## Conventions

- Route handlers delegate to `src/lib/post-route-logic.ts` with dependency injection for testability
- `framer.ts` is the server-side client; `framer-core.ts` runs in a spawned child process to avoid bundling `framer-api` into the Next.js server
- All Notion bridge logic lives in `src/lib/notion.ts`; it is self-contained and only imported by Notion API routes
- UI components use shadcn/ui primitives from `src/components/ui/`
- CSS theming uses custom properties defined in `globals.css` (dark mode by default)
- Env validation is centralized — do not scatter `process.env` reads
- Keep edits small and localized; avoid unnecessary abstractions
