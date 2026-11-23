# Middlesex County Maker Fest Planning Hub — v2

**Purpose:** Cloudflare-native planning website + access-controlled committee CMS. Original Maker Fest proposal and Maker Quest are separate and unaffected.

## Stack
- Hono 4.13.21
- htmx 2.x (`htmx.org`)
- Vite 8.3.8 + `@cloudflare/vite-plugin` 1.70.1
- Wrangler 4.167.0
- Cloudflare Workers, D1
- `jose` for verifying Cloudflare Access tokens

## Quick start
1. `npm install`
2. The dedicated staging D1 database has already been created and configured: `maker-fest-planning-hub-v2-staging`. Do not create or reuse another database unless intentionally migrating.
3. Its database ID is already set in `wrangler.jsonc`.
4. `npm run db:migrate:local`, then `npm run dev`.
5. Before enabling *any* admin access, configure Cloudflare Zero Trust Access and an **allow policy for specific trusted editors only** on the admin and admin API routes. Obtain `ACCESS_TEAM_DOMAIN` (e.g., `https://yourteam.cloudflareaccess.com`) and `ACCESS_AUD` from Access and configure both as Worker secrets/variables. The Worker verifies the Access JWT cryptographically, checks issuer and audience, and rejects admin requests if any value is missing.
6. `npm run db:migrate:remote`, `npm run build` and deploy to the **staging worker**. Only promote to the existing Planning Hub after verification.

**Important:** Cloudflare Access is not yet enabled for this account, so admin routes are intentionally locked (HTTP 503) until configured. Do not disable the server-side auth checks as a shortcut. Authorization can later be expanded to committee-specific roles.

## Phase 1 implemented in source
- Public program and committee listing from D1
- Restricted CMS screen with editable content title/body/status
- Restricted activity creation and committee assignment edits
- Audit logging on changes
- htmx partial swaps

## Production readiness checklist
- [ ] Install packages and run typecheck/build (network access unavailable in the creation environment)
- [ ] Confirm compatibility of the pinned versions in a real Node environment
- [ ] Configure D1 + apply migrations
- [ ] Enable Cloudflare Access; verify valid and invalid sessions
- [ ] Add CSRF controls and restrictive Content Security Policy before enabling admin writes
- [ ] Add backup/restore process, role permissions, and approval workflow
- [ ] Test accessibility, mobile usability, error handling, and data imports
- [ ] Publish staging and perform end-to-end checks

The current public Planning Hub should remain in place until the replacement has been fully tested.

## Cloudflare-first staging status (2026-11-23)
- Staging Worker: `maker-fest-planning-hub-v2-staging` (separate deployment).
- Staging database initialized and seeded.
- Current remote preview is a read-only Cloudflare Worker using D1. It is **not yet the Hono/Vite/htmx bundle**.
- Admin is locked, and existing public sites have not been modified.
- Full application build and security checks remain required before publishing a functional CMS.
- Cloudflare staging deployment connected — November 23, 2026.
