# FramerLink Product Shell Plan

## Summary

- Hosted SaaS with open signup
- Minimal public landing page on `/`
- Authenticated product under `/dashboard`
- Clerk for auth and invitations
- Convex for site, membership, and onboarding persistence
- Existing Notion to Framer bridge preserved as backend-only legacy functionality

## Phase 1 Decisions

- Product name: `FramerLink`
- Roles: `admin`, `contributor`
- One Framer project and one user-managed collection per team
- No user-facing Notion integration in this phase
- Do not redesign the existing dashboard/editor UI yet
- Gate dashboard access until onboarding is complete and the Framer key has been validated

## FramerLink Setup Flow

1. Sign up or sign in
2. Create a team
3. Paste Framer project URL or ID
4. Paste Framer Server API key
5. Validate the connection
6. Select one user-managed collection
7. Save the site configuration and enter the dashboard

## Backend Split

- `Convex`
  - site record
  - membership mirror
  - onboarding state
  - encrypted Framer connection metadata
- `Clerk`
  - auth
  - organizations
  - invites
  - admin/contributor role source
- `Next.js`
  - landing page
  - onboarding page
  - dashboard pages
  - Framer CRUD routes
  - legacy Notion webhook, sync, and import routes

## Preservation Rule

The existing Notion webhook and Framer sync pipeline stays in this repo and keeps using the legacy env/app-config flow until a future phase explicitly migrates it.
