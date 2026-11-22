# CALLORIA v8.2 — GUI Installation

Target repository: `zaksz1991/calloria`  
Branch: `main`  
Production site: `https://calloria.vercel.app`

## 1. Back up and merge the overlay

1. Back up the current local `calloria` repository folder.
2. Extract `CALLORIA-v8.2-WORKFORCE-CLOUD-INTEGRATION.zip` in Windows File Explorer.
3. Open the existing CALLORIA repository in GitHub Desktop.
4. Select **Repository → Show in Explorer**.
5. Copy the extracted package contents into the existing repository root. Merge folders and replace matching files. Do not copy the outer wrapper folder.
6. Keep the hidden `.git` directory. Do not delete or replace your existing `public/assets/`, GLB models, local environment files, or any unlisted project files.

## 2. Files replaced by v8.2

Replace these complete files:

- `vite.config.js`
- `package.json`
- `build/calloria-workforce-development-suite-v8.mjs`
- `build/calloria-production-integration-gate-v8.mjs`
- `tools/calloria-build-preflight.mjs`
- `tools/calloria-v8-integration-audit.mjs`
- `tests/calloria-v8-integration.test.mjs`
- `tests/workforce-trend-cloud-sync-v801-contract.test.mjs`

Add these new v8.1 feature files if they are not already present:

- `build/calloria-workforce-trend-cloud-sync-v801.mjs`
- `js/workforce-trend-cloud-sync-engine-v801.js`
- `styles/calloria-workforce-trend-cloud-sync-v801.css`
- `tests/workforce-trend-cloud-sync-v801.test.mjs`
- `tests/workforce-trend-cloud-sync-v801-ui.test.mjs`
- `tests/workforce-trend-cloud-sync-v801-contract.test.mjs`
- `tests/calloria-v82-workforce-cloud-integration.test.mjs`
- `supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql`

Keep every existing build plugin that is not listed above, especially `build/calloria-digital-experience-suite-v722.mjs` and the GLB/world/office plugins. The cloud-history plugin is now registered inside the central v8 suite. Do not add a second direct registration to `vite.config.js`.

## 3. Supabase migration safety

The v8.2 integration change itself adds no database migration. The cloud-history capability uses the v8.1 migration:

`supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql`

Before running it:

1. Open the existing RuffNeck shared Supabase project used by CALLORIA.
2. Confirm the CALLORIA tenancy foundation is already installed.
3. Confirm these database objects exist: `public.organizations`, `public.has_calloria_org_permission(uuid, text)` and the organisation membership grants used by CALLORIA.
4. Check whether `public.calloria_workforce_trend_snapshots` and `public.calloria_save_workforce_trend_snapshots(uuid, jsonb)` already exist.
5. If both already exist from v8.1, do not run the migration again.
6. If they do not exist, and the tenancy/permission prerequisites are present, run the migration once in Supabase SQL Editor and verify successful completion.
7. If the tenancy or permission prerequisites are missing, stop. Do not improvise by creating or changing shared Prospector tables or auth triggers.

No new Vercel environment variable, Edge Function, API key or Supabase secret is introduced. Do not expose a service-role key in browser code or a `VITE_` variable.

## 4. Commit and deploy

1. In GitHub Desktop, review the changed-file list. Confirm no unrelated files, GLB assets or `.git` contents were deleted.
2. Commit with: `CALLORIA v8.2 — unified workforce cloud-history integration`.
3. Push to `main`.
4. Confirm Vercel reports a successful production deployment. A successful commit or passing local test suite is not a deployment result.

## 5. Acceptance checks

1. Confirm `npm run build` runs build preflight, navigation audit, the v8 integration audit, Vite compilation and the post-build artifact audit.
2. Confirm the v8 integration audit reports **11 ordered workforce plugins**, 20 HTML pages and the chat-widget entry.
3. Confirm the cloud-history plugin occurs once in the central suite and is not separately registered in `vite.config.js`.
4. Open the Supervisor workspace using an authenticated organisation member with `reports:read`.
5. Capture local workforce trend snapshots and explicitly save them to the organisation.
6. Open the same organisation from another authorised browser/device and load/merge its history.
7. Confirm guest mode still works locally and does not upload anything.
8. Confirm local Clear history does not delete cloud organisation snapshots.
9. Confirm a role without `reports:read` cannot load or save organisation history.
10. Confirm the database retains no more than 90 snapshots per organisation.

## Verification limits

The included 143-test suite and 49 JavaScript syntax checks pass in the overlay workspace. This workspace does not contain the complete CALLORIA repository, original application pages, every pre-existing Vite plugin or the production `node_modules`; therefore the full Vite build and the live Supabase/Vercel/browser acceptance checks must be confirmed after merging.
