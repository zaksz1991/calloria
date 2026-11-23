# CALLORIA v8.5 — Updated Files Installation

This ZIP contains only new or updated files. It is an overlay for the existing `zaksz1991/calloria` repository, not a replacement project.

## Files in this release

- `build/calloria-workforce-trend-cloud-sync-v801.mjs` — replace.
- `js/workforce-trend-backup-engine-v805.js` — add.
- `styles/calloria-workforce-trend-cloud-sync-v801.css` — replace.
- `package.json` — replace with this version; it preserves existing dependencies and scripts and adds the v8.5 recovery test commands.
- `tools/calloria-build-preflight.mjs` — replace.
- `tools/calloria-v8-integration-audit.mjs` — replace.
- `tests/workforce-trend-backup-v805.test.mjs` — add.
- `tests/calloria-v8-integration.test.mjs` — replace.
- `docs/CHANGELOG-v8.5.md`, `docs/INSTALL-v8.5.md`, `docs/TEST-RESULTS-v8.5.txt` — add.

## Install with GitHub Desktop and File Explorer

1. Make a backup of the current local CALLORIA repository folder.
2. Extract this ZIP.
3. In GitHub Desktop, open the existing `zaksz1991/calloria` repository and choose **Repository → Show in Explorer**.
4. Copy the ZIP contents into the repository root. Merge the listed folders and replace only the matching files shown above. Do not copy an outer wrapper folder.
5. Keep the hidden `.git` directory, all unlisted application files, `public/assets/`, all GLB models, local environment files and existing Supabase/Vercel configuration.
6. Do not replace `vite.config.js` or the central workforce suite registration. The existing cloud-history plugin is upgraded in place and remains in its established order.
7. In GitHub Desktop, review the changed-file list. It should contain only the files listed in the ZIP manifest.
8. Commit with `CALLORIA v8.5 — verified workforce history recovery backup` and push to `main`.
9. Treat production as verified only after Vercel completes a successful production build and the deployed workflow is tested.

## Supabase and Vercel

- No new migration is required for v8.5.
- Do not rerun migrations `202611220001`, `202611220002` or `202611220003`. Confirm the existing v8.1–v8.4 workforce history schema is already applied before testing organisation history/conflict export.
- No new Edge Function, secret, API key or Vercel environment variable is required.
- Keep existing Node/Vite build settings and environment values unchanged.

## Acceptance test after deployment

1. Sign into an organisation account with `reports:read` access and open the workforce trend history panel.
2. Select **Export recovery backup**. Confirm the JSON file downloads and reports local, organisation and conflict record counts.
3. Keep a copy of the JSON outside the browser/device.
4. In a test browser profile for the same organisation, select **Verify / restore backup** and choose the downloaded file.
5. Confirm the organisation fingerprint matches and the confirmation dialog describes a browser-local restore.
6. Confirm the local trend history is merged, current browser-local values take priority on matching timestamps, and the status explicitly states that Supabase records were not changed.
7. Test a modified JSON file and a backup from another organisation. Both must be rejected without changing local or cloud history.
8. Separately test the existing **Save local history to organisation** action only after reviewing the restored data.

Do not treat SHA-256 as a digital signature: the checksum detects corruption but does not authenticate the creator of the file.
