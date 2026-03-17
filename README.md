# Framer Blog Editor

Internal Next.js dashboard for reading, creating, and updating posts in one existing unmanaged Framer CMS collection. The app now also supports a Notion-to-Framer bridge, so the same deployment can act as both the internal editor and the backend sync service.

## What it does

- Connects to Framer over the Server API WebSocket via `framer-api`
- Locates a single existing collection by name
- Maps collection field names to field IDs using `getFields()`
- Lists posts, fetches a single post, creates posts, and updates posts
- Uses `collection.addItems()` for both create and update
- Creates new posts as drafts
- Publishes automatically when editing an existing post
- Can sync approved Notion pages into the same unmanaged Framer collection
- Can backfill existing Framer posts into Notion for later editing
- Can publish a Framer site update after a Notion-triggered sync
- Keeps the UI and API open for fast internal testing

## Quick validation

1. Copy `.env.example` to `.env`.
2. Fill in `FRAMER_API_KEY`.
3. Run `npm install`.
4. Run `npm run framer:check`.
5. If the script shows your target collection, fields, and existing items, the Framer connection is working.
6. Start the dashboard with `npm run dev`.
7. Open [http://localhost:3000](http://localhost:3000) and test fetch/create/update from the UI.

## Environment variables

Required:

- `FRAMER_API_KEY`

Optional Notion bridge:

- `NOTION_API_KEY`
- `NOTION_WEBHOOK_SECRET`

Everything else is hardcoded in `src/lib/app-config.ts` for this internal deployment, including:

- Framer project binding
- Framer collection name
- Notion data source ID
- Notion property names and approval rule
- Notion field mapping overrides

Example:

```env
FRAMER_API_KEY=ap_your_server_api_key
NOTION_API_KEY=secret_xxx
NOTION_WEBHOOK_SECRET=choose-a-long-random-secret
```

## Local development

```bash
npm install
npm run framer:check
npm run dev
```

The dashboard routes are:

- `/` simple blog table
- `/posts/new` create form
- `/posts/:id` edit form

API routes:

- `GET /api/meta/fields`
- `GET /api/posts`
- `GET /api/posts/:id`
- `POST /api/posts`
- `PUT /api/posts/:id`
- `POST /api/notion/webhook`
- `POST /api/notion/sync`
- `POST /api/notion/import`

## Manual test flow

1. Open `/`.
2. Confirm the table loads your blog posts.
3. Create a draft post from `/posts/new`.
4. Edit a post from the hover action in the table.
5. Confirm the post appears in Framer CMS and the edited version is published.

## Notion bridge setup

This mode keeps the dashboard intact and adds a backend bridge for approved Notion content.

### Notion prerequisites

1. Create a Notion integration and copy its API key into `NOTION_API_KEY`.
2. Share the target Notion data source with that integration.
3. Confirm the hardcoded data source ID in `src/lib/app-config.ts` points at the correct Notion data source. Do not use the parent database ID.
4. Add these properties in Notion so they match the hardcoded bridge config:
   - `Status` as a status/select property
   - `Slug` as a text or formula property
   - `Framer Item ID` as a rich text property
   - optional writable date properties such as `CMS Created At` and `CMS Updated At` if you want Framer item audit timestamps mirrored into Notion
5. Keep the page title in the data source title property.
6. Put the article body in the page content itself. The bridge fetches the page as markdown and maps it into the Framer body field.

### Framer mapping

- The bridge reuses the same Framer collection metadata lookup used by the dashboard.
- It matches Notion properties to Framer fields by logical meaning first (`title`, `body`, `author`, `date`, `slug`) and then by field name.
- The override map lives in `src/lib/app-config.ts`.
- When importing Framer posts into Notion, the field map can also target `createdAt`, `lastUpdated`, and `lastUpdatedBy`.
- If your names do not line up, update the hardcoded field map. Example:

```ts
fieldMap: {
  author: "Writer",
  date: "Publish Date",
  slug: "Permalink",
  createdAt: "CMS Created At",
  lastUpdated: "CMS Updated At",
}
```

### Webhook flow

Recommended setup:

1. Deploy this app.
2. In Notion Automations, create a rule:
   - trigger: `Status` changes
   - action: `Send webhook`
3. Point the webhook at:

```text
https://your-domain.com/api/notion/webhook
```

4. Add one of these auth options to the request:
   - header `x-notion-bridge-secret: <NOTION_WEBHOOK_SECRET>`
   - or header `Authorization: Bearer <NOTION_WEBHOOK_SECRET>`

The webhook route can sync a single page when the payload contains a page ID. If that page is no longer approved, the matching Framer item is removed instead. If the payload does not contain a page ID, the route falls back to syncing all approved pages in the data source.

## Manual testing

### Test the bridge without Notion Automations

Trigger a full approved-pages sync:

```bash
curl -X POST http://localhost:3000/api/notion/sync \
  -H "Content-Type: application/json" \
  -H "x-notion-bridge-secret: choose-a-long-random-secret" \
  -d '{}'
```

Trigger a single-page sync:

```bash
curl -X POST http://localhost:3000/api/notion/sync \
  -H "Content-Type: application/json" \
  -H "x-notion-bridge-secret: choose-a-long-random-secret" \
  -d '{"pageId":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}'
```

If that page is no longer approved, the same request removes the matching Framer item and republishes the site.

Backfill existing Framer posts into Notion:

```bash
curl -X POST http://localhost:3000/api/notion/import \
  -H "Content-Type: application/json" \
  -H "x-notion-bridge-secret: choose-a-long-random-secret" \
  -d '{}'
```

Backfill one Framer post into Notion:

```bash
curl -X POST http://localhost:3000/api/notion/import \
  -H "Content-Type: application/json" \
  -H "x-notion-bridge-secret: choose-a-long-random-secret" \
  -d '{"postId":"your-framer-item-id"}'
```

### Expected result

- Approved Notion pages are created or updated in the configured unmanaged Framer collection.
- Pages that leave the approved state are removed from Framer when the webhook or manual sync request includes their page ID.
- The Framer item ID is written back into the `Framer Item ID` Notion property when possible.
- Existing Framer posts can be imported into Notion and matched back to existing pages by Framer item ID or slug.
- Newly created Notion pages from Framer are seeded with the approved status when the Framer post is not a draft. Existing page statuses are preserved.
- Framer item audit timestamps can be mirrored into writable Notion properties via the hardcoded field map in `src/lib/app-config.ts`.
- If anything changed, Framer publishes a new site deployment.

## Deployment

### Vercel

1. Create a new Vercel project from this repo.
2. Add the secret env vars from `.env`.
3. Deploy.

Vercel works well here because the app is a standard Next.js project and the Framer API connection is opened per request.

### Railway or another Node host

1. Set the same secret env vars.
2. Use the default build/start commands:

```bash
npm run build
npm run start
```

Use Node.js 22+ because `framer-api@0.1.2` requires it.

## Notes

- There is no delete UI and there are no explicit delete API routes, but the Notion bridge can remove bridge-managed Framer items when a page leaves the approved state.
- The dashboard only touches the configured collection.
- For unsupported Framer field types, the UI shows the value as read-only.
- The “Last updated” column is tracked for edits made through this dashboard via Framer item plugin data. New items also record a plugin-backed `createdAt` timestamp for Framer-to-Notion exports.
- The Notion bridge is optional. If it is not configured, the dashboard still works normally.
