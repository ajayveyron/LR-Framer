# Tech Stack

- Next.js 16 (App Router, React 19, `nodejs` runtime)
- TypeScript 5.9 (strict mode, path alias `@/*` → `./src/*`)
- Tailwind CSS 4 via `@tailwindcss/postcss`
- shadcn/ui (Radix primitives, `radix-nova` style, CSS variables for theming)
- `framer-api` for CMS reads/writes (spawned as a child-process RPC via `scripts/framer-rpc.mjs`)
- Zod 4 for env validation and request schema checks
- `react-hook-form` + `@hookform/resolvers` for form handling
- `date-fns` for date formatting
- `lucide-react` for icons (shadcn default; user prefers phosphor icons for new work)
- Structured JSON logging via `src/lib/logger.ts` (wide events pattern)

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | ESLint with zero warnings |
| `npm run test` | Node test runner (`src/**/*.test.ts`) |
| `npm run framer:check` | Validate Framer connection (needs env vars) |
| `npm run build` | Production build (only when explicitly asked) |

Prefer `typecheck` and `lint` for validation. Only run `framer:check` when touching Framer behavior and env vars are present. Do not run `build` unless the user asks.

## Testing

Tests use the Node built-in test runner (`node --import tsx --test`). Test files live alongside source as `*.test.ts`. No external test framework (jest/vitest) is configured.

## Environment

Env vars are validated centrally in `src/lib/env.ts` using Zod. Framer vars are required; Notion vars are optional. Never modify `.env` files directly — tell the user what to change.
