# CALLORIA v8.8 — GUI Installation

Target repository: `zaksz1991/calloria`  
Branch: `main`  
Vercel project: `calloria`

## Merge the updated files

1. Back up the current CALLORIA repository folder.
2. Extract this ZIP in Windows File Explorer.
3. Open the existing CALLORIA repository in GitHub Desktop.
4. Select **Repository → Show in Explorer**.
5. Copy the contents of `CALLORIA-v8.8-UPDATED-FILES` into the existing repository root. Merge the folders and replace only the five existing files listed in `UPDATED-FILES.txt`.
6. Add the new engine, tests and documentation at the exact paths listed in the manifest.
7. Do not delete `.git`, `public/assets/`, GLB models, `.env` files, Supabase configuration or any unrelated project files.
8. Return to GitHub Desktop. Review the changed-file list and confirm the new engine is under `js/`, both v8.8 tests are under `tests/`, and the cloud plugin remains under `build/`.
9. Commit with message: `CALLORIA v8.8 — cloud recovery progress checklist`.
10. Push to `main` and inspect the Vercel deployment log.

## Check after deployment

1. Open CALLORIA using an account with workforce `reports:read` access.
2. Open Workforce Trend History → Organisation history.
3. Run **Run read-only health check**.
4. For each warning or failed check, mark recovery steps as they are completed. Confirm the card's progress count changes.
5. Reload the page and rerun diagnostics. Confirm progress remains for that same organisation and is separate when another organisation is selected.
6. Use **Reset checklist** on one card and confirm only that card's progress is cleared.
7. Mark every step complete on an unresolved check. Confirm the interface still says verification is pending.
8. Repair the underlying issue through the correct administrator or recovery process, rerun the health check and confirm the passed item disappears from the runbook.
9. Repeat at a narrow phone width and with keyboard-only navigation.

## Supabase and Vercel

- No Supabase migration or RPC change is required.
- No Edge Function, secret or environment-variable change is required.
- No dependency version change is required.
- Do not disable RLS or place a service-role key in browser variables.

## Verification boundary

The focused v8.7/v8.8 progress and integration tests, syntax checks and plugin transformation smoke test are run during package preparation. This archive does not establish that your full current repository test suite, complete Vite production build, live Supabase permissions, actual browser session, physical phone or Vercel deployment has passed. Those must be confirmed against the real repository and deployment.
