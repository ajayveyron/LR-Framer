# Webflow CMS Provider Support — Implementation Plan

## Context

FramerLink currently supports Framer as the sole CMS backend. This plan covers adding Webflow as a second CMS provider so that during onboarding a team can choose either Framer or Webflow, and the entire dashboard, API layer, and AI tooling works against whichever provider was selected.

### Why this is feasible

- `post-route-logic.ts` already uses dependency injection (`PostRouteDependencies`) — route handlers don't know about Framer.
- `cms-types.ts` defines provider-agnostic types (`BlogPostRecord`, `BlogCollectionMetadata`, `DashboardFieldDefinition`).
- Dashboard components (`post-editor.tsx`, `blog-table.tsx`) consume those generic types — zero Framer imports.
- Webflow has an official TypeScript SDK (`webflow-api` on npm) with built-in retries and typed responses.
- Webflow's CMS field types map closely to the existing `DashboardFieldType` enum.

### Key API differences to account for

| Concern | Framer | Webflow |
|---|---|---|
| Auth | API key per project | Bearer token (site token or OAuth) |
| Identifiers | projectId + collectionId | siteId + collectionId |
| Draft semantics | `draft: true` = not visible on site | `isDraft: true` on a live item = still visible, has unpublished changes. Must call `unpublishItem` to hide. |
| Publishing | `publishSite()` deploys everything | Per-item publish (`publishItem`) OR site-wide publish. Also has `updateItemLive` for direct live updates. |
| Audit metadata | Plugin data keys (`lr:lastEditedAt`, etc.) | No plugin data equivalent — store in Convex instead |
| Child process | `framer-api` can't bundle into Next.js, needs RPC child process | `webflow-api` is a standard REST client, no child process needed |
| Rate limits | Undocumented | 60 req/min (Basic) to 120 req/min (Business). 429 with `Retry-After` header. SDK has built-in backoff. |
| Bulk ops | Single-item only | Single + bulk (up to 100 items per call) |
| Field limit | No documented limit | 60 fields per collection |
| Rich text | `formattedText` field type | `RichText` field type (HTML). No code block support via API. |

### Field type mapping

| `DashboardFieldType` | Framer field | Webflow field |
|---|---|---|
| `string` | `string` | `PlainText` |
| `formattedText` | `formattedText` | `RichText` |
| `number` | `number` | `Number` |
| `boolean` | `boolean` | `Switch` |
| `date` | `date` | `DateTime` |
| `enum` | `enum` | `Option` |
| `link` | `link` | `Link` |
| `image` | `image` | `ImageRef` |
| `file` | `file` | `File` |
| `color` | `color` | `Color` |
| `collectionReference` | `collectionReference` | `ItemRef` |
| `multiCollectionReference` | `multiCollectionReference` | `MultiReference` |

---

## Phase 0 — CMS Provider Interface (no behavior change)

**Goal:** Extract a provider interface from the existing Framer code without changing any runtime behavior. Everything still runs through Framer. This is pure refactoring.

### 0.1 Define `CmsProvider` interface

Create `src/lib/cms-provider.ts`:

```ts
export type CmsProviderType = "framer" | "webflow";

export interface CmsRuntimeContext {
  provider: CmsProviderType;
  apiKey: string;            // Framer API key or Webflow bearer token
  siteOrProjectId: string;   // Framer projectId or Webflow siteId
  collectionId?: string | null;
  collectionName?: string | null;
}

export interface CmsProvider {
  readonly type: CmsProviderType;

  // Metadata
  getBlogMetadata(): Promise<BlogCollectionMetadata>;
  getAllCollections(): Promise<CollectionSummary[]>;
  getCollectionFields(collectionId: string): Promise<DashboardFieldDefinition[]>;

  // CRUD
  listBlogPosts(): Promise<BlogPostSummary[]>;
  getBlogPostById(id: string): Promise<BlogPostRecord>;
  createBlogPost(input: UpsertBlogPostInput, actor: string): Promise<{ post: BlogPostRecord; publish?: PublishResponse }>;
  updateBlogPost(id: string, input: UpsertBlogPostInput, actor: string): Promise<{ post: BlogPostRecord; publish?: PublishResponse }>;
  deleteBlogPost(id: string, actor: string): Promise<{ postId: string; publish?: PublishResponse }>;

  // Publishing
  publishSite?(): Promise<PublishResponse>;

  // Dashboard overview (optional — Framer has caching/snapshot, Webflow may not need it)
  getDashboardOverview?(limit?: number): Promise<DashboardOverview>;
}
```

### 0.2 Wrap existing Framer code as `FramerCmsProvider`

Create `src/lib/providers/framer-provider.ts` that implements `CmsProvider` by delegating to the existing `framer.ts` functions. No logic changes — just wrapping.

### 0.3 Generalize runtime context

Rename `FramerRuntimeContext` → keep it, but add a parallel `CmsRuntimeContext` in `cms-provider.ts`. The `AsyncLocalStorage` in `framer-runtime.ts` stays as-is for now. A new `cms-runtime.ts` will wrap it and add provider dispatch.

### 0.4 Update `post-route-handlers.ts`

Instead of importing directly from `framer.ts`, resolve the provider from context and build `PostRouteDependencies` from it. The route files (`src/app/api/posts/route.ts`) stay unchanged.

### 0.5 Verify

- `npm run typecheck` passes
- `npm run test` passes
- Dashboard works identically (still Framer-only)

---

## Phase 1 — Convex Schema + Onboarding Changes

**Goal:** Store which CMS provider a site uses, and let onboarding collect Webflow credentials.

### 1.1 Convex schema changes

Add to the `sites` table:

```ts
cmsProvider: v.optional(v.union(v.literal("framer"), v.literal("webflow"))),
// Webflow-specific fields
webflowAccessToken: v.optional(v.string()),   // encrypted, like framerApiKeyCiphertext
webflowSiteId: v.optional(v.string()),
webflowCollectionId: v.optional(v.string()),
webflowCollectionName: v.optional(v.string()),
```

Default `cmsProvider` to `"framer"` for existing sites (migration-safe — treat `undefined` as `"framer"`).

Add a `webflowSiteClaims` table (mirrors `framerProjectClaims`):

```ts
webflowSiteClaims: defineTable({
  webflowSiteId: v.string(),
  clerkOrganizationId: v.string(),
  claimedAt: v.number(),
}).index("by_site", ["webflowSiteId"])
  .index("by_org", ["clerkOrganizationId"]),
```

### 1.2 Webflow onboarding validation

Create `src/lib/webflow-onboarding.ts`:

- Accept a Webflow site token (or OAuth token)
- Call `webflow.sites.get(siteId)` to validate connectivity
- List collections via `webflow.collections.list(siteId)`
- Return validated site info + collection options (same shape as Framer validation)

### 1.3 Onboarding UI — provider selection step

Add a provider selection step before the CMS validation step in the onboarding flow. Two cards: Framer / Webflow. Selection determines which validation form appears next.

### 1.4 Onboarding complete route

Update `src/app/api/onboarding/complete/route.ts` to branch on provider:

- Framer path: unchanged
- Webflow path: validate Webflow connection, encrypt token, store in `webflowAccessToken`, set `cmsProvider: "webflow"`

### 1.5 Update `product-access.ts`

`getDashboardAccess` and `requireDashboardApiAccess` currently check for `framerApiKeyCiphertext` and `framerProjectId`. Generalize the "is site ready?" check:

```ts
// Site is ready if it has valid CMS credentials for its provider
const isReady = site.cmsProvider === "webflow"
  ? site.webflowAccessToken && site.webflowSiteId
  : site.framerApiKeyCiphertext && site.framerProjectId;
```

---

## Phase 2 — Webflow Provider Implementation

**Goal:** Build the actual `WebflowCmsProvider` that implements the `CmsProvider` interface.

### 2.1 Install SDK

```bash
npm install webflow-api
```

### 2.2 Create `src/lib/providers/webflow-provider.ts`

Implement `CmsProvider` using the `webflow-api` SDK:

- `getBlogMetadata()` → `client.collections.get(collectionId)` → map fields to `DashboardFieldDefinition[]`
- `listBlogPosts()` → `client.collections.items.listItems(collectionId)` → paginate, map to `BlogPostSummary[]`
- `getBlogPostById(id)` → `client.collections.items.getItem(collectionId, id)` → map to `BlogPostRecord`
- `createBlogPost(input)` → `client.collections.items.createItem(collectionId, { fieldData, isDraft: true })` → map response
- `updateBlogPost(id, input)` → if `input.publish`, use `client.collections.items.updateItemLive(...)`, else use staged update
- `deleteBlogPost(id)` → `client.collections.items.deleteItem(collectionId, id)`
- `publishSite()` → `client.sites.publish(siteId, { publishToWebflowSubdomain: true })`

### 2.3 Field value mapping

Create `src/lib/providers/webflow-field-map.ts`:

- Map Webflow field types → `DashboardFieldType`
- Map `DashboardFieldValue` → Webflow write format (e.g., image needs `{ url }` object)
- Map Webflow read values → `DashboardFieldValue`
- Handle Option fields (Webflow uses option `id` strings, need to resolve labels from collection schema)

### 2.4 Logical field detection

Reuse the same pattern-matching approach from `framer-core.ts` (`LOGICAL_FIELD_PATTERNS`) — match field display names to logical keys (title, body, author, date). This is provider-agnostic.

### 2.5 Draft/publish semantics adapter

This is the trickiest part. Create a mapping layer that translates the app's draft/publish model to Webflow's:

| App action | Webflow API call |
|---|---|
| Create as draft | `createItem` (default `isDraft: true` since Dec 2024) |
| Update + auto-publish | `updateItemLive` (updates staged + live in one call) |
| Update as draft | `updateItem` (staged only) |
| Unpublish / draft a live item | `unpublishItem` then set `isDraft: true` |
| Delete | `deleteItem` (unpublishes from live automatically) |

### 2.6 Audit tracking

Since Webflow has no plugin data, store audit fields (`lastEditedAt`, `lastEditedBy`, `createdAt`) in Convex per-item. Add a lightweight `cmsItemAudit` table or embed in existing structures.

---

## Phase 3 — Runtime Context + Route Wiring

**Goal:** Make the API routes and dashboard provider-aware.

### 3.1 Create `src/lib/cms-runtime.ts`

```ts
const cmsRuntimeStorage = new AsyncLocalStorage<CmsRuntimeContext>();

export function runWithCmsContext<T>(ctx: CmsRuntimeContext, cb: () => Promise<T>) {
  return cmsRuntimeStorage.run(ctx, cb);
}

export function getCmsContext(): CmsRuntimeContext { ... }
```

### 3.2 Provider factory

```ts
export function createCmsProvider(ctx: CmsRuntimeContext): CmsProvider {
  switch (ctx.provider) {
    case "framer": return new FramerCmsProvider(ctx);
    case "webflow": return new WebflowCmsProvider(ctx);
  }
}
```

### 3.3 Update `product-framer.ts` → `product-cms.ts`

`runWithCurrentSiteFramerContext` becomes `runWithCurrentSiteCmsContext`. It reads `site.cmsProvider` to build the right context, then runs the callback inside `runWithCmsContext`.

### 3.4 Update route files

`src/app/api/posts/route.ts` changes from:

```ts
return await runWithCurrentSiteFramerContext(request, () => handleListPosts());
```

to:

```ts
return await runWithCurrentSiteCmsContext(request, () => handleListPosts());
```

The `handleListPosts` function resolves the provider from context internally.

### 3.5 Update `post-route-handlers.ts`

Instead of hardcoding Framer imports, resolve from context:

```ts
const provider = createCmsProvider(getCmsContext());
const dependencies: PostRouteDependencies = {
  createBlogPost: (input, actor) => provider.createBlogPost(input, actor),
  getBlogMetadata: () => provider.getBlogMetadata(),
  // ...
};
```

---

## Phase 4 — AI Tools + Settings

**Goal:** Make AI CMS tools and settings pages provider-aware.

### 4.1 Provider-aware AI tools

`framer-tools.ts` → `cms-tools.ts`. The tool definitions stay the same (they're already generic: "get collections", "add items", etc.) but the `execute` functions resolve the provider from context instead of calling Framer directly.

Keep the `framer_` prefix tools as aliases for backward compatibility with existing chat histories, but add generic `cms_` prefixed tools that route through the provider.

### 4.2 Settings page

`src/app/dashboard/(workspace)/settings/page.tsx` and `site-settings-form.tsx` currently show Framer-specific settings (project URL, collection picker). Make this conditional:

- Framer: show current Framer settings
- Webflow: show Webflow site info, collection picker, token management

### 4.3 Help dialogs

`framer-help-dialogs.tsx` is Framer-specific. Create a parallel `webflow-help-dialogs.tsx` or make the existing one provider-aware.

---

## Phase 5 — Notion Bridge Compatibility (optional)

The Notion bridge currently syncs to Framer. If Webflow sites also need Notion sync:

- The bridge sync types (`BridgeSyncInput`, `BridgeSyncResponse`) are already provider-agnostic
- `notion-bridge-core.ts` would need to resolve the CMS provider and call the right provider's sync methods
- This is lower priority — can be deferred until a Webflow site actually needs Notion sync

---

## What doesn't need to change

- `cms-types.ts` — already generic
- `post-route-logic.ts` — already uses DI
- `post-schema.ts` — field validation is provider-agnostic
- Dashboard UI components — consume generic types
- Billing, auth, team management — provider-independent
- `logger.ts` — just add `cmsProvider` to wide event fields

---

## Estimated effort

| Phase | Work | Duration |
|---|---|---|
| Phase 0 | Provider interface + Framer wrapper (refactor only) | 2–3 days |
| Phase 1 | Convex schema + onboarding changes | 2–3 days |
| Phase 2 | Webflow provider implementation | 4–5 days |
| Phase 3 | Runtime context + route wiring | 2 days |
| Phase 4 | AI tools + settings UI | 2–3 days |
| Phase 5 | Notion bridge (optional) | 1–2 days |
| **Total** | | **~2.5–3 weeks** |

## Risks

- **Webflow rate limits** (60 req/min on Basic) could be tight for dashboard overview loads with many items. May need aggressive caching or pagination UX.
- **Rich text parity** — Webflow's RichText doesn't support code blocks via API. If blog posts use code blocks, they'll be lost on Webflow.
- **Draft semantics mismatch** — The app assumes draft = not visible. Webflow's `isDraft` on a live item doesn't hide it. The adapter layer in Phase 2.5 handles this, but it's the most likely source of bugs.
- **Image uploads** — Webflow requires publicly accessible URLs for image writes. The current upload proxy may need adjustment.
- **OAuth vs site tokens** — Site tokens are simpler (like Framer API keys) but scoped to one site. OAuth is more flexible but adds an auth flow. Start with site tokens for parity with the Framer onboarding model.

## Open questions

1. Should we support OAuth for Webflow (multi-site access) or just site tokens (single site, simpler)?
2. Do Webflow sites need Notion bridge support, or is that Framer-only?
3. Should the product name change from "FramerLink" to something provider-neutral?
4. Do we want to support switching providers on an existing site, or is it a one-time onboarding choice?
