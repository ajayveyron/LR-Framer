# Product

LinkRunner Blog CMS — an internal Next.js dashboard for managing a single unmanaged Framer CMS collection (default: "Blog"). The dashboard supports creating, editing, and listing blog posts backed by the Framer API.

An optional Notion-to-Framer sync bridge allows approved Notion pages to be synced into the Framer CMS. The bridge is fully opt-in; the dashboard works without any Notion configuration.

Key behaviors:
- New posts are created as drafts
- Edited posts auto-publish on save
- Notion-synced posts land as unpublished for manual review
- When a Notion page loses "Approved" status it is drafted in Framer, not deleted
- Only archived/trashed Notion pages trigger removal from Framer

Brand: LinkRunner.io — dark-mode SaaS aesthetic, brand primary `#4D4BF6`.
