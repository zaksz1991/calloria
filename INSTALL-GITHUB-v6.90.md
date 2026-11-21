# CALLORIA v6.90 — GUI installation

## Release type

Cumulative overlay containing the v6.89 shift close-out report and the v6.90 live Shift Command Centre. It is not a complete repository replacement.

## Compatibility check — do this first

This package is based on the public `main` source shell inspected on 21 November 2026, which identifies itself as `CALLORIA · BUILD 1.4.0`.

Earlier Vercel logs supplied in this conversation show package version `0.3.0` and a different Vite plugin chain. Do not overwrite a `0.3.0` checkout's `index.html` with this package unless that branch has first been reconciled to the current public `main` source. A successful test of this overlay does not prove it matches the deployed commit.

## Files in this package

| Package path | Repository destination | Action |
|---|---|---|
| `index.html` | Repository root | Replace only when using the matching public `main` / BUILD 1.4.0 shell |
| `js/calloria-shift-review-v6-89.mjs` | `js/` | Add if not already present |
| `calloria-shift-review-v6-89.css` | Repository root | Add if not already present |
| `js/calloria-shift-command-centre-v6-90.mjs` | `js/` | Add |
| `calloria-shift-command-centre-v6-90.css` | Repository root | Add |
| `tests/*.test.mjs` | `tests/` | Merge the two focused test files |

## Install with GitHub Desktop and File Explorer

1. Open GitHub Desktop and select the `calloria` repository.
2. Select **Repository → Show in Explorer**.
3. Make a backup copy of the existing `index.html`.
4. Confirm that the existing shell contains the `CALLORIA · BUILD 1.4.0` version label and the public-main navigation structure. If it still represents the older `0.3.0` deployment source, stop; do not replace the HTML.
5. Copy the package's `index.html` into the repository root and replace the matching file.
6. Open the repository's `js` folder. Copy `calloria-shift-command-centre-v6-90.mjs` into it. Keep `calloria-shift-review-v6-89.mjs` if it is already installed; do not create duplicate copies.
7. Copy `calloria-shift-command-centre-v6-90.css` into the repository root. Keep `calloria-shift-review-v6-89.css` if it is already installed.
8. Merge the two `.test.mjs` files into the existing `tests` folder.
9. Return to GitHub Desktop and review the changed-file list. The expected changes are one matching root HTML replacement, two new v6.90 assets, and any missing v6.89 support assets/tests.
10. Commit as `CALLORIA v6.90 — live shift command centre` and push to `main`.
11. Check the Vercel deployment result before opening a saved employee shift.

## What to test in the browser

1. Open the game and load an employed save.
2. Start a shift. The **SHIFT CONTROL** launcher should appear at the lower-right of the screen.
3. Open the panel. It should display voice queue, digital queue, callbacks due, CRM follow-ups and supervisor requests from the active save.
4. Use a task's Open button. It should navigate to the corresponding existing CALLORIA view without accepting or changing the task.
5. Close the panel with the close button, outside click or Escape.
6. End the shift. The v6.89 shift close-out report should still appear.
7. Repeat at a narrow mobile viewport. The drawer should fit within the screen and respect device safe-area insets.

## Preserved project files

Do not delete or replace `.git/`, `vite.config.js`, `package.json`, lockfiles, existing application engines, `public/assets/`, `.glb` files, Supabase migrations, Edge Functions, `.env*` files, Vercel settings or existing cloud-save configuration.

No new package install or database migration is required.
