# CALLORIA v6.94 — GUI installation

## Release type

Targeted cumulative source overlay for the current public `main` source. This is not a complete repository replacement.

## Files to add

- `build/calloria-case-resolution-transaction-guard-v6-94.mjs`
- `tests/calloria-case-resolution-transaction-guard-v6-94.test.mjs`
- `tests/fixtures/case-lifecycle-before-v694.mjs` (test fixture only; never imported by the app)

Apply the two additions in `VITE-CONFIG-ADDITIONS-v6.94.txt` to the existing `vite.config.js`.

## GUI workflow

1. Create a backup/restore point of the current GitHub `main` branch.
2. Open the existing repository folder through GitHub Desktop: **Repository → Show in Explorer**.
3. Copy the new build plugin into `build/`.
4. Copy the test file into `tests/` and its fixture into `tests/fixtures/`.
5. Open `vite.config.js` in GitHub's web editor or your normal text editor.
6. Add the import and the single plugin registration from `VITE-CONFIG-ADDITIONS-v6.94.txt`.
7. Keep the existing v6.84–v6.93 registrations and all other Vite plugins. Do not register v6.94 twice.
8. Review GitHub Desktop's Changes tab. Expected changes: one Vite config edit, one new build plugin, one new test and one new test fixture.
9. Commit as `CALLORIA v6.94 — transactional case outcome integrity` and push to `main`.
10. Check the Vercel deployment log for completion of `vite build`.

## What it repairs

The existing `completeCaseFollowUp()` and `reviewCaseFollowUp()` functions check explicit customer confirmation only after writing some attempt/review fields. v6.94 moves the same checks ahead of all outcome writes. A rejected close attempt therefore leaves the operational follow-up data unchanged, instead of partially changing it before the validation error is raised.

## Source compatibility

The plugin targets `js/case-lifecycle-engine.js` and requires the current unique code anchors for both closure functions. It is deliberately strict: if your branch contains a materially different case lifecycle implementation, Vite will stop with a clear source-rebase error rather than apply an incomplete patch. Do not remove that guard to force a deployment.

## Preservation

Do not replace `index.html`, `main.js`, `package.json`, `.env` files, Supabase configuration, `public/assets/`, any `.glb` files or previous feature modules. No database migration or new environment variable is required.
