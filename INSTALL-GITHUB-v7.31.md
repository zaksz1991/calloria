# CALLORIA v7.31 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`  
**Release:** Workforce Trend & Evidence History

## 1. Preserve the current project

1. Make a backup copy of the current local `calloria` repository folder.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Keep the hidden `.git` directory. Do not delete or replace the repository.
5. Preserve the complete original application source, `public/assets/`, GLB models, local `.env` files, Vercel environment variables and Supabase settings.

## 2. Merge the release files

1. Extract `CALLORIA-v7.31-WORKFORCE-TREND-HISTORY.zip` in Windows File Explorer.
2. Open the extracted `CALLORIA-v7.31` folder.
3. Merge the included `build`, `js`, `styles`, `tests` and `docs` folders into their matching repository folders. Allow matching release files to be added or replaced; do not delete unrelated files.
4. Add `CHANGELOG-v7.31.md`, `README.md` and `INSTALL-GITHUB-v7.31.md` to the repository root.
5. The archive carries forward the v7.23–v7.30 workforce overlay files. When your current checkout is already at v7.30, the new runtime files are the three v7.31 files listed in section 4, the two v7.31 tests and the Vite registration. Keep earlier release modules already in the checkout.

## 3. Register the v7.31 Vite plugin

The plugin must execute immediately after the v7.30 command-centre plugin.

Add this import once near the other workforce plugin imports in `vite.config.js`:

```js
import { calloriaWorkforceTrendHistoryPluginV731 } from './build/calloria-workforce-trend-history-v731.mjs';
```

In the `plugins` array, keep the v7.30 call and add v7.31 directly after it:

```js
calloriaWorkforceCommandCentrePluginV730(),
calloriaWorkforceTrendHistoryPluginV731()
```

Do not duplicate either line. If your checkout has later project-specific Vite changes, merge these two entries into the current config rather than replacing the whole file. Preserve every existing 3D, GLB, OJT, mobile, multichannel, Supabase and multi-page build registration.

The transform requires the v7.30 command-centre marker, import, render call and template insertion. It skips safely rather than partially editing `main.js` when the expected v7.30 integration is absent or changed. Ensure the full v7.23–v7.30 chain is present before adding v7.31.

## 4. Confirm the new v7.31 files

- `js/workforce-trend-history-engine-v731.js`
- `build/calloria-workforce-trend-history-v731.mjs`
- `styles/calloria-workforce-trend-history-v731.css`
- `tests/workforce-trend-history-v731.test.mjs`
- `tests/vite-config-v731.test.mjs`
- Updated `vite.config.js`

The supplied overlay also carries forward the v7.23–v7.30 workforce engines, transforms, styles and tests. It does not replace `js/main.js` directly; Vite transforms the main module during the build.

## 5. Supervisor acceptance checks

1. Use an employed profile and open **Supervisor**.
2. Scroll below **Workforce intelligence command centre**. Confirm **Workforce trend and evidence history** appears after the v7.30 panel.
3. Confirm the first visit shows that a baseline is required and that no historic trend is invented.
4. Select **Capture current snapshot**. Confirm the snapshot count increases and the status explains that the snapshot is stored in this browser.
5. Refresh the page and confirm the saved snapshot remains in the same browser.
6. Generate new retained simulation activity, revisit Supervisor and check the comparison against the saved baseline.
7. Confirm completed replies and response-target increases are shown as positive; reductions in open, overdue and at-risk work are also positive.
8. Confirm new channels/departments are labelled as new and missing data is unscored.
9. Select **Export trend history CSV** and inspect the aggregate summary, workstream and department sections.
10. Select **Clear local history** and confirm the browser prompt. After clearing, the panel must return to its no-baseline state.
11. Repeat at narrow phone width. Tables should scroll inside their own containers without forcing page-wide horizontal overflow.

## 6. Data and configuration boundaries

- No Supabase migration, Edge Function deployment or database write is introduced.
- No Vercel environment variable, secret, API key or npm dependency is added.
- Snapshots include aggregate counts/rates, workstream labels and explicitly mapped department names. They exclude individual employee IDs, customer details, case references and conversation transcripts.
- Up to 90 snapshots are stored in browser localStorage. This history belongs only to the browser/device used to capture it. It is not cloud-synchronised, organisation-shared or backed up automatically; anyone with access to the same browser profile may also access its saved history.
- Snapshot capture is manual. No scheduler or background monitoring is added.
- Trend changes compare two captured states and must not be presented as causal findings or formal HR decisions.

## 7. Commit and deploy

1. Review the changed-file list in GitHub Desktop. Confirm `.git`, original application files, `public/assets/`, GLB models, `.env` files and project-specific configuration remain present.
2. Commit with message `CALLORIA v7.31 — workforce trend and evidence history`.
3. Push to `main`.
4. Inspect the complete Vercel deployment log. Treat the release as deployed only after the existing Vercel project reports a successful production deployment.

## 8. Verification boundary

- 121 automated tests passed; 0 failed.
- 38 JavaScript/MJS files passed syntax checks.
- Generated v7.23 → v7.31 transform syntax, safe skip, idempotency, retention, trend scoring, department/channel matching and CSV safety were tested.
- Full Vite production build, GitHub push, Vercel deployment, full production browser rendering and physical Android/iOS testing were not performed in the preparation environment.
