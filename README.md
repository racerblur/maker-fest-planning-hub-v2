# Middlesex County Maker Fest Planning Hub v2

FUBAR Labs uses the Planning Hub to publish event information and coordinate organizer work. The app runs on Hono, htmx, Vite, Cloudflare Workers, D1 and Cloudflare Access.

## Develop and validate

Use Node.js 24 and npm.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

The local server uses a separate D1 database. Admin screens require a valid Cloudflare Access JWT and a CMS role even in local development. The integration test uses a test signing key and a fresh in-memory SQLite database.

```sh
npm run typecheck
npm run build
npm test
```

Pull requests run the same checks and apply both migrations to a disposable local D1 database.

## Organize the event

- **Website content** lets editors create drafts, change display order and preview content privately. Administrators publish sections. Saving changes to a published section keeps the currently published version live until an administrator publishes the revision.
- **Committees**, **Committee members** and **Tasks** cover chairs, co-chairs, membership, responsibilities, progress, assignments and deadlines. Committee summaries and chair names appear on the public committees page. Administrators manage committee records.
- **Programming** and **Event schedule** edit the same activities. Administrators approve and schedule activities. Use Eastern local time and select “Public when scheduled” to publish the activity. The public views show scheduled activities marked public and omit internal coordinators.
- **Partners**, **Partner contacts**, **Sponsors** and **Volunteers** are private. Create partner organizations and committees before adding related contacts and members.
- **CMS access** lets administrators grant or revoke roles for users allowed through Cloudflare Access. The **Audit log** shows the 100 latest CMS changes. Archive and restore require administrator confirmation. Restored website content and activities require explicit publication.

## Release to v2 staging

The staging target is the Worker [maker-fest-planning-hub-v2-staging](https://maker-fest-planning-hub-v2-staging.racerblur.workers.dev/). Its D1 database uses the same name and ID `f5ef243a-d484-42a1-a885-76f73d09a808`. Confirm both before releasing.

1. Verify the staging Access application and its allow policy. Its issuer and audience must match the Worker configuration. The Access policy and CMS role each have to allow the organizer.
2. Record the current staging Worker version and a [D1 Time Travel bookmark](https://developers.cloudflare.com/d1/reference/time-travel/) before applying migrations. Keep the bookmark in the deployment record within its retention period.
3. Inspect the migration ledger. If importing this release into a legacy database with the baseline tables but no ledger, first verify the schema matches `0001_initial.sql`. Register that migration as applied in the Wrangler ledger without running its seed statements again. On a fresh database, apply both migrations normally.
4. Run the commands below with a Cloudflare identity authorized for the v2 Worker and database.

```sh
npx wrangler d1 time-travel info maker-fest-planning-hub-v2-staging
npx wrangler d1 migrations list maker-fest-planning-hub-v2-staging --remote
npm run db:migrate:remote
npm run build
npm run deploy
```

For a new staging database, insert the designated administrator's exact Access email in `cms_users` with role `admin`. Run the following SQL with bound parameters and record the operator identity in `updated_by`.

```sql
INSERT INTO cms_users(email,role,updated_by) VALUES (?, 'admin', ?);
```

5. Smoke test the public overview, committees, programming, schedule and static assets. Open `/admin` while signed out to verify the Access challenge. Sign in with an allowed administrator, then verify that an Access user with no CMS role is denied.

For Worker rollback, redeploy the previous staging version. The CMS migration is additive and can remain in place. Use Time Travel only when recovering data and after accounting for any writes after the bookmark.

### GitHub staging workflow

The **CMS checks** workflow also supports a manual staging release. Configure the GitHub `staging` environment with the `CLOUDFLARE_ACCOUNT_ID` variable, a scoped `CLOUDFLARE_API_TOKEN` secret and any required reviewers. Use the workflow after the environment and baseline migration ledger are set up. It reruns validation, records the D1 bookmark in the job log, applies pending migrations and deploys to v2 staging.

Cloudflare Workers Builds validates the CMS pull request branch with `npx wrangler deploy --dry-run` after the build. This packages the Worker for validation without creating a branch preview or connecting one to the staging database.
