# Install CALLORIA v6.98 — QA Consistency & Coaching Intelligence

## Release type

This is an additive source overlay, not a complete repository replacement. It does not bundle or replace prior shift, CRM, case lifecycle, GLB, Supabase or gameplay code. It is independent of the v6.96/v6.97 CRM overlays and can coexist with them when those patches are already installed.

## 1. Back up the repository

In GitHub Desktop, select `calloria` and choose **Repository → Show in Explorer**. Copy the repository folder or at minimum back up `vite.config.js`, `js/main.js`, `js/qa-workspace-engine.js` and the `build`, `js` and `tests` folders.

## 2. Merge the files

Extract the ZIP. Merge its `build`, `js` and `tests` folders into the repository root. Do not delete existing files in those folders.

New files:

- `build/calloria-qa-quality-intelligence-v6-98.mjs`
- `js/qa-quality-intelligence-v698.js`
- `js/qa-quality-intelligence-v698.css`

## 3. Register the Vite plugin once

Open `vite.config.js` in your normal text editor.

Add the import shown in `VITE-CONFIG-ADDITIONS-v6.98.txt` beside the other build-plugin imports. Add `calloriaQAQualityIntelligencePluginV698()` as the last entry in the existing `plugins` array, after the visitor/public experience plugins. Keep the existing plugin order unchanged. Do not register it twice.

The transformer checks the current QA import, calibration grouping line and dispute/calibration panel location before making any edits. If the branch has changed, it emits a warning and skips without partially editing `main.js`.

## 4. Preserve existing configuration and data

Do not replace `index.html`, `js/main.js`, `js/qa-workspace-engine.js`, package files, Supabase files, `.env` files, `public/assets/`, GLB models or save data. No Supabase migration, new environment variable, API endpoint, network request or third-party package is required.

Keep previously installed v6.94/v6.95 case-lifecycle protections, v6.96/v6.97 case overlays and earlier mobile/3D plugins as they are. v6.98 does not replace them.

## 5. Commit and deploy

In GitHub Desktop, review the new files and the `vite.config.js` change, then commit and push to `main`.

Suggested commit message:

`CALLORIA v6.98 — QA consistency and coaching intelligence`

Inspect the complete Vercel build log. A focused test pass is not proof of a full Vite build or production deployment.

## 6. Verify in the app

Open **QA → Human QA & calibration**. The new **QA consistency & coaching intelligence** panel appears between the Human QA review register and the dispute/calibration workspace.

Use synthetic records to check:

- Three or more low ratings on the same scorecard criterion become a priority coaching theme.
- Fewer than three observations are labelled early signals, not established patterns.
- Reviewer score spread of 10 points or more and criterion rating spread of 2 or more appear in calibration exceptions.
- Open, upheld and adjusted disputes are counted separately.
- Existing dispute submission, dispute resolution, calibration creation and scorecard configuration still work.
- Narrow phone layouts display two metric columns and a single content column.

The panel is advisory and read-only. It does not change official QA scores, disputes, coaching records, employee status or promotion eligibility.
