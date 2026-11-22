# CALLORIA v8.1 — GUI installation

Target repository: `zaksz1991/calloria`  
Branch: `main`  
Production site: `https://calloria.vercel.app`

## 1. Preserve the current repository

This release assumes the v8.0.1 build-audit repair is already merged into the current `main` branch. It adds the next feature on top of that baseline; it does not replace the v8.0.1 integration files.

1. Back up the existing local `calloria` repository folder.
2. Extract `CALLORIA-v8.1-ORG-TREND-SYNC.zip` in Windows File Explorer.
3. Open the existing CALLORIA repository in GitHub Desktop and choose **Repository → Show in Explorer**.
4. Merge the extracted release contents into the repository root. Do not copy an outer wrapper folder.
5. Replace `vite.config.js` and `package.json` with the complete files in this package.
6. Add the new files at the exact paths:
   - `build/calloria-workforce-trend-cloud-sync-v801.mjs`
   - `js/workforce-trend-cloud-sync-engine-v801.js`
   - `styles/calloria-workforce-trend-cloud-sync-v801.css`
   - `tests/workforce-trend-cloud-sync-v801.test.mjs`
   - `tests/workforce-trend-cloud-sync-v801-ui.test.mjs`
   - `tests/workforce-trend-cloud-sync-v801-contract.test.mjs`
   - `supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql`
7. Keep the existing `.git` directory, all other application modules, all earlier v7.22–v7.31 files, `public/assets/`, every GLB model, and all local environment files. This is an overlay, not a full repository replacement.
8. Do not remove the v8.0 suite imports or the production integration gate. v8.1 registers after that gate and after the v7.31 transform chain.

## 2. Apply the Supabase migration

1. Open the existing RuffNeck shared Supabase project used by CALLORIA.
2. Confirm the CALLORIA tenancy migration `202611070001_calloria_server_tenancy.sql` is already applied and that `organizations`, `organization_memberships`, `has_calloria_org_permission` and `reports:read` grants are present.
3. Open `supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql` from this release.
4. Paste the complete SQL into a new Supabase SQL Editor query and run it once.
5. Confirm the table `calloria_workforce_trend_snapshots` and RPC `calloria_save_workforce_trend_snapshots` exist.
6. Do not rerun earlier migrations. Do not alter Prospector tables or auth triggers.

No Edge Function is added. No new Supabase secret or Vercel environment variable is required. Never place a service-role key in browser code or a `VITE_` variable.

## 3. Run local release checks and deploy

1. In GitHub Desktop, review the changed-file list and ensure there are no deleted project files or assets.
2. Commit with: `CALLORIA v8.1 — organisation workforce trend sync`.
3. Push to `main`.
4. Confirm Vercel reports a successful production build before considering the deployment complete.
5. The full existing Vite build must still run its normal preflight, navigation audit, v8 integration audit and post-build artifact audit.

## 4. Acceptance checks after deployment

1. Open CALLORIA and enter a signed-in organisation workspace using a role with `reports:read` (owner, admin, manager, supervisor or QA under the current permission matrix).
2. Open the Supervisor workspace and find **Workforce trend and evidence history**.
3. Capture two local aggregate snapshots. Confirm the saved count increases.
4. Select **Save local history to organisation**. Confirm a successful save status.
5. Open the same organisation in another browser profile/device using a separate authorised account with report access.
6. Select **Load and merge organisation history**. Confirm the cloud snapshots appear in trend history and the comparison baseline is available.
7. Confirm a role without `reports:read` cannot read or save organisation history.
8. Test guest mode. The game and local snapshot workflow must continue to work; cloud actions must not upload anything without an authenticated active organisation.
9. Confirm a local Clear history action does not delete organisation snapshots. Cloud deletion is intentionally not exposed in this release.
10. Confirm the database retains no more than 90 snapshots per organisation.

## 5. Verification boundary

The included tests validate the pure history adapter, merge rules, bounded retention, plugin transform anchors and fail-closed behaviour. This package-preparation environment does not execute the SQL against your Supabase project, verify live RLS, test a real cross-device session, run the full Vite production build, or deploy to Vercel. Confirm those checks from the actual Supabase and Vercel dashboards.
