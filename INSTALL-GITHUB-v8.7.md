# CALLORIA v8.7 — GUI Installation

Target repository: `zaksz1991/calloria`  
Branch: `main`  
Existing Vercel project: `calloria`

## Files to merge

Use `UPDATED-FILES.txt` as the authoritative manifest. Replace only the five listed existing files and add the seven new files at the exact paths shown. Do not copy a wrapper folder into the repository root.

1. Back up the existing local CALLORIA repository folder.
2. Extract this ZIP in Windows File Explorer.
3. Open the existing CALLORIA repository in GitHub Desktop.
4. Select **Repository → Show in Explorer**.
5. Copy the contents of `CALLORIA-v8.7-UPDATED-FILES` into the repository root. Merge folders and replace the five matching files listed in the manifest.
6. Do not delete `.git`, `public/assets/`, GLB models, `.env` files, other project folders or existing user changes.
7. Return to GitHub Desktop and review the complete changed-file list. Confirm the two new tests are present under `tests/`, the new engine is under `js/`, and the shared cloud plugin remains in `build/`.
8. Commit with message: `CALLORIA v8.7 — guided workforce cloud recovery`.
9. Push to `main` and inspect the resulting Vercel deployment log.

## Verification after deployment

1. Open the existing CALLORIA Supervisor workspace using an account with organisation workforce-report access.
2. Open Workforce Trend History → Organisation history.
3. Run **Run read-only health check**.
4. Confirm non-passing checks display a matching **Recommended recovery steps** card.
5. Use **Copy recovery steps** and confirm the copied text contains only the fixed recovery guidance.
6. When the Supabase session check warns, use **Refresh sign-in session**. Confirm CALLORIA reruns diagnostics and updates the health report.
7. Confirm a normal successful report says no recovery action is required.
8. Verify that no snapshot, conflict, backup or organisation role is changed merely by viewing the recovery cards.
9. Repeat at desktop width and a narrow phone viewport.

## Supabase and Vercel

- No new Supabase migration is required.
- No Edge Function deployment or secret change is required.
- No new Vercel environment variable is required.
- Preserve the Node 22 pin and the existing Vite build configuration.
- Do not disable RLS or add a service-role key to browser/Vercel `VITE_` variables to work around a failed permission check.

## Verification boundary

The included 11 focused regression tests, syntax checks and plugin-transform smoke test passed during package preparation. A complete repository `npm test`, full `npm run build`, live Supabase authentication/organisation RLS, actual desktop browser workflow, physical mobile device and Vercel deployment were not run from this workspace. Verify those against the real repository and production deployment.
