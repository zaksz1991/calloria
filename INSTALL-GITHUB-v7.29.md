# CALLORIA v7.29 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`  
**Release:** Workforce Performance Intelligence

## Release baseline

This is a cumulative v7.23–v7.29 source overlay, not a complete repository replacement. It expects the v7.23–v7.28 digital follow-up, coaching, sustainment and career-evidence plugin chain. The v7.28 installer already explains the earlier merge sequence. Do not skip missing prior overlays.

## 1. Back up and preserve the existing project

1. Make a backup copy of your current local `calloria` repository folder.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Keep the hidden `.git` directory. Do not delete or replace the repository.
5. Preserve `public/assets/`, all GLB models, local environment files, deployment settings and every unrelated application file.

## 2. Merge the v7.29 files

1. Extract `CALLORIA-v7.29-WORKFORCE-PERFORMANCE-INTELLIGENCE.zip` in Windows File Explorer.
2. Open the extracted `CALLORIA-v7.29` folder.
3. Merge the `build`, `js`, `styles`, `tests` and `docs` folders into the matching folders in the existing repository. Keep unrelated files.
4. Add `CHANGELOG-v7.29.md`, `README.md` and `INSTALL-GITHUB-v7.29.md` to the repository root.
5. Review `vite.config.js` before replacing it. The supplied config carries forward the v7.28 plugin sequence. Replace it only when your existing config exactly matches that v7.28 baseline and has no later project-specific changes.
6. If your current config already has v7.28 but contains later changes, keep the current file and merge only these two additions:

   Import beside the v7.28 import:

   `import { calloriaWorkforceIntelligencePluginV729 } from './build/calloria-workforce-intelligence-v729.mjs';`

   Add after `calloriaDigitalCareerEvidencePluginV728()` in the `plugins` array:

   `calloriaWorkforceIntelligencePluginV729(),`

7. Preserve plugin order: v7.23 supervisor → v7.24 performance → v7.25 coaching → v7.26 coaching outcomes → v7.27 sustainment checkpoints → v7.28 career evidence → v7.29 workforce intelligence.
8. Confirm these v7.29 files exist:
   - `js/workforce-intelligence-engine-v729.js`
   - `build/calloria-workforce-intelligence-v729.mjs`
   - `styles/calloria-workforce-intelligence-v729.css`
   - `tests/workforce-intelligence-v729.test.mjs`
   - `tests/vite-config-v729.test.mjs`
9. In GitHub Desktop, review the changed-file list. Confirm `.git`, `public/assets/`, GLB models and unrelated files remain untouched.
10. Commit with message `CALLORIA v7.29 — workforce performance intelligence`, then push to `main`.
11. Check the existing Vercel deployment. Treat the release as deployed only after Vercel reports a successful production deployment.

## 3. Supervisor acceptance checks

1. Sign in or enter a hired profile and open **Supervisor**.
2. Scroll below **Workforce career evidence** to **Workforce performance intelligence**.
3. Confirm the current profile identity uses the same `EMP-<initials>` convention as the existing assigned-agent records.
4. Confirm voice volume, QA, CSAT and shift-adherence values display with their own sample counts.
5. Confirm digital performance is joined to the current profile only when the employee ID matches exactly.
6. Confirm other digital agents remain in the separate digital-agent table and are not given guessed voice, QA, CSAT or attendance values.
7. Confirm missing evidence displays as `—` or `Insufficient evidence`, not as a zero score.
8. Confirm the Service Evidence Index displays its coverage percentage and requires at least two available dimensions.
9. Confirm incident counts or critical voice flags display a supervisor-review indicator.
10. Confirm the page does not expose a promote, discipline, pay-change or employment-status action. The panel is read-only.
11. Repeat at narrow mobile width and confirm the cards stack and the digital agent table scrolls horizontally without expanding the page.

## 4. Configuration and data requirements

- No Supabase migration is required.
- No Supabase Edge Function deployment is required.
- No new Vercel environment variable or secret is required.
- No new npm dependency is required.
- The panel reads retained local simulation state and v7.24–v7.28 evidence only. It does not connect to an external ACD, HRIS, payroll or biometric attendance platform.
- For reliable cross-channel employee matching, the underlying channel records must use the same employee ID. The current local player ID is derived from `EMP-` plus `nameInitials`; the plugin does not infer identities from display names.

## 5. Verification boundary

The v7.23–v7.29 source overlay tests and generated transform syntax checks are run and reported in `docs/TEST-RESULTS-v7.29.txt`. A complete Vite production build is not claimed because this preparation workspace does not contain the complete repository with installed dependencies. GitHub push, Vercel deployment and physical-device checks must be verified in the existing project.
