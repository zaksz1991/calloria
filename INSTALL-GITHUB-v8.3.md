# CALLORIA v8.3 — Cloud History Conflict Guard

This archive contains **only the files added or replaced by v8.3**. It is an overlay for the existing CALLORIA v8.2 repository, not a full application archive.

## Files included

| Path | Action |
|---|---|
| `build/calloria-workforce-trend-cloud-sync-v801.mjs` | Replace |
| `js/workforce-trend-cloud-sync-engine-v802.js` | Add |
| `styles/calloria-workforce-trend-cloud-sync-v801.css` | Replace |
| `supabase/migrations/202611220002_calloria_workforce_trend_conflict_guard.sql` | Add and apply once |
| `tools/calloria-v8-integration-audit.mjs` | Replace |
| `tools/calloria-build-preflight.mjs` | Replace |
| `package.json` | Replace with the included manifest (dependencies and existing build commands remain pinned) |
| `tests/calloria-v8-integration.test.mjs` | Replace |
| `tests/workforce-trend-cloud-sync-v801-ui.test.mjs` | Replace |
| `tests/workforce-trend-cloud-sync-v801-contract.test.mjs` | Replace |
| `tests/workforce-trend-cloud-sync-v802.test.mjs` | Add |

## Install using GitHub Desktop and File Explorer

1. Make a backup of the existing `calloria` repository folder.
2. Extract this ZIP.
3. Open the existing `zaksz1991/calloria` repository in GitHub Desktop and select **Repository → Show in Explorer**.
4. Copy the ZIP's included `build`, `js`, `styles`, `supabase`, `tools`, and `tests` folders into the repository root. Replace only files with matching paths and add the new files.
5. Replace the root `package.json` with the included version. It keeps the existing Node 22 pin and package dependencies; it extends the focused cloud-history test command.
6. Keep `.git`, `public/assets/`, all GLB models, local environment files and all other application files. Do not copy an outer wrapper folder into the repository.
7. Review the changed-file list. It should contain only the files listed above, plus this release documentation.
8. Commit with message `CALLORIA v8.3 — conflict-safe workforce cloud history`, then push to `main`.

## Supabase migration

The v8.3 migration depends on the v8.1 table and normalisation function.

1. In Supabase migration history, confirm `202611220001_calloria_workforce_trend_cloud_history.sql` has already been applied.
2. Check that `202611220002_calloria_workforce_trend_conflict_guard.sql` has not already been applied.
3. Apply migration `202611220002_calloria_workforce_trend_conflict_guard.sql` exactly once in the existing CALLORIA Supabase project.
4. Do not rerun migration 001. Do not modify RuffNeck Prospector tables, Auth triggers, organisation tables or existing secrets.

Migration 002 adds no table and alters no stored snapshot. It replaces the old save RPC's last-writer-wins behaviour with conflict protection and adds `calloria_sync_workforce_trend_snapshots_v802`, which returns inserted, unchanged and conflicting counts. Both RPCs continue to validate the signed-in user's `reports:read` organisation permission. The detailed RPC never overwrites a different snapshot at the same organisation/capture-time key.

## Acceptance checks after deployment

1. Sign into an organisation account with workforce report access and open the Workforce Trend History panel.
2. Save local history. Confirm the status reports inserted snapshots.
3. Repeat the same save. Confirm inserted is zero and the same records are reported unchanged; no duplicate rows should be created.
4. Load and compare organisation history. Confirm identical snapshots merge without warnings.
5. In a staging organisation only, submit two different aggregate snapshots with the same `capturedAt`. Confirm the detailed RPC reports a conflict and the previously stored organisation snapshot remains unchanged.
6. Confirm a conflict warning says the browser-local version remains on the device and the organisation version remains in cloud history. Export local history before clearing browser storage.
7. Check Vercel for a successful production build and check the browser console for runtime errors.

## Configuration and release boundaries

- No new Vercel variable, API key, Edge Function, provider integration or dependency is required.
- No `vite.config.js` or central plugin-suite registration change is required; the existing v8.2 cloud plugin slot is updated in place.
- The full production build, execution of migration 002 against the live Supabase project and live multi-user synchronisation were not performed in the preparation environment. Verify them in Vercel and Supabase before treating v8.3 as production-ready.
