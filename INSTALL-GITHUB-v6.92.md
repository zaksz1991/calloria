# CALLORIA v6.92 — GUI installation

## Release type

Cumulative overlay for the existing v6.91 source baseline. Not a complete repository replacement.

## Files to add or replace

| Package path | Repository destination | Action |
|---|---|---|
| `index.html` | Repository root | Replace only after confirming it matches the current v6.91/public-main baseline; otherwise add the two references manually |
| `calloria-agent-handover-preflight-v6-92.css` | Repository root | Add |
| `js/calloria-agent-handover-preflight-v6-92.mjs` | `js/` | Add |
| `tests/calloria-agent-handover-preflight-v6-92.test.mjs` | `tests/` | Add |
| `CHANGELOG-v6.92.md`, `SOURCE-BASELINE-v6.92.md`, `VERIFICATION-v6.92.md` | Repository root or docs folder | Optional documentation |

The new `index.html` adds these exact references:

```html
<link rel="stylesheet" href="/calloria-agent-handover-preflight-v6-92.css" />
<script type="module" src="/js/calloria-agent-handover-preflight-v6-92.mjs"></script>
```

The module reference must appear after the existing v6.90 shift command module and before `/js/main.js`. Do not add a second reference if the current HTML already contains it.

## Install with GitHub Desktop and File Explorer

1. Open GitHub Desktop and select `calloria`.
2. Choose **Repository → Show in Explorer**.
3. Extract the ZIP in a separate folder.
4. Compare the repository `index.html` with the included file. If the deployed checkout is not the v6.91/public-main baseline, do not replace the whole HTML file. Add only the two references shown above in the same locations, preserving all newer app markup and current CSS/script tags.
5. Copy `calloria-agent-handover-preflight-v6-92.css` to the repository root.
6. Copy `js/calloria-agent-handover-preflight-v6-92.mjs` into the repository `js/` folder.
7. Copy the test file into the existing `tests/` folder. Keep all existing tests.
8. Do not copy, replace or delete `agent-handover-engine.js`, `main.js`, `vite.config.js`, Supabase files, environment files or public model assets.
9. Review the changes in GitHub Desktop. Expected production changes: one new CSS file, one new JS module and the two new references in `index.html`.
10. Commit as `CALLORIA v6.92 — agent handover preflight and reconciliation` and push to `main`.
11. Confirm the correct commit is deployed successfully in Vercel before testing the Handover view.

## Browser verification

1. Open **People & systems → Agent shift handover** (or use the Handover navigation item).
2. Confirm the new **Handover preflight & reconciliation** panel appears above the existing transfer form.
3. Check eligible work counts against the existing candidate list.
4. Start or maintain an inbound/outbound interaction; preflight should report a blocker while the existing create form remains disabled.
5. Confirm supervisor-review follow-ups and other employees' digital contacts are reported separately, not counted as this employee's eligible work.
6. Download the audit and confirm the file contains the candidate list, pending transfer totals and limitations.
7. Confirm no ownership, callbacks, CRM records or save-state fields change by opening the panel or exporting the report.
8. Repeat at a mobile viewport; the panel should stack into one column without horizontal scrolling.

## Preserve

Preserve `.git/`, `public/assets/` and all `.glb` files, `agent-handover-engine.js`, `js/main.js`, all existing CSS/JS modules, Supabase migrations/functions, `.env*`, Vercel configuration, `vite.config.js`, `package.json` and lockfiles.
