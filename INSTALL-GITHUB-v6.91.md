# CALLORIA v6.91 — GUI installation

## Release type

Cumulative overlay carrying v6.89 shift close-out and v6.90 Shift Control, upgraded with v6.91 shift rhythm and adherence. Not a complete repository replacement.

## Updated files

| Package path | Repository destination | Action |
|---|---|---|
| `js/calloria-shift-command-centre-v6-90.mjs` | `js/` | Replace existing v6.90 file with this v6.91-compatible version |
| `calloria-shift-command-centre-v6-90.css` | Repository root | Replace existing v6.90 stylesheet |
| `tests/calloria-shift-command-centre-v6-90.test.mjs` | `tests/` | Replace; assertion now checks v6.91 runtime |
| `tests/calloria-shift-rhythm-v6-91.test.mjs` | `tests/` | Add |

The current public `index.html` already references these asset URLs. No `index.html`, `vite.config.js`, `package.json` or lockfile change is required for the runtime upgrade. The package includes the current v6.89/v6.90 shell and support files as reference copies.

## Install with GitHub Desktop and File Explorer

1. Open GitHub Desktop and select `calloria`.
2. Select **Repository → Show in Explorer**.
3. Open the extracted v6.91 folder in a separate File Explorer window.
4. Copy the replacement `js/calloria-shift-command-centre-v6-90.mjs` into the repository's `js` folder and replace the existing file.
5. Copy the replacement `calloria-shift-command-centre-v6-90.css` into the repository root and replace the existing file.
6. Merge the two test files into the repository's `tests` folder. Do not overwrite unrelated tests.
7. Do not copy the included `index.html` unless your current file is missing the v6.89/v6.90 stylesheet and module references. The patch is designed to keep the existing HTML references unchanged.
8. Review GitHub Desktop changes. Expected production changes: two asset replacements. Test changes: one test replacement and one new test file. Documentation may also be added.
9. Commit as `CALLORIA v6.91 — shift rhythm and adherence monitor` and push to `main`.
10. Confirm the Vercel deployment is green before testing an active employee shift.

## Browser checks

- Start an employee shift and open **SHIFT CONTROL**.
- Confirm adherence percentage and schedule match the shift record.
- Before 10:00, confirm next break shows 10:00. During a scheduled break, confirm the panel identifies the open window.
- With a live interaction or digital assignment, confirm the panel says to finish customer work before taking a break.
- Confirm no active work is accepted, closed, transferred or changed by opening the panel.
- Repeat at a narrow mobile viewport; break facts and schedule chips should stack without horizontal scrolling.

Preserve `.git/`, `public/assets/`, all `.glb` files, Supabase migrations and functions, `.env*`, Vercel settings, `vite.config.js`, `package.json`, lockfiles and existing application engines. No migration or secret changes are needed.
