# CALLORIA v7.09 — GUI installation

This is an additive source overlay, not a complete repository replacement.

## Files included

- `js/first-shift-mentor-engine-v709.js`
- `build/calloria-first-shift-mentor-v709-plugin.mjs`
- `build/calloria-first-shift-mentor-v709-runtime.js`
- `calloria-first-shift-mentor-v709.css`
- `tests/first-shift-mentor-v709.test.mjs`
- `VITE-CONFIG-ADDITIONS-v7.09.txt`

## Install using GitHub Desktop and File Explorer

1. Make sure the latest CALLORIA `main` branch is selected in GitHub Desktop and all previous v7.04–v7.08 changes you intend to keep are committed.
2. Select **Repository → Show in Explorer**.
3. Extract this ZIP into a separate temporary folder.
4. Copy the supplied `js`, `build`, `tests` folders and the CSS file into the repository root. Merge folders when Windows asks; do not delete existing files.
5. Open the root `vite.config.js` in the GitHub web editor or a plain text editor.
6. Follow the exact two-line placement instructions in `VITE-CONFIG-ADDITIONS-v7.09.txt`. Add the plugin import once and place the plugin call after `calloriaTryItStudioPlugin()` as the last plugin entry. Do not replace the configuration file.
7. Return to GitHub Desktop, review the changed files, and commit:
   `CALLORIA v7.09 — first shift mentor and evidence review`
8. Push to `main` and inspect the Vercel build log.

## What this release changes

The current CALLORIA code already contains product/service learning, CRM practice, shadowing, supervised simulated practice, trainer review, workstation allocation and a briefing gate. v7.09 does not duplicate those modules. It completes the next gap: monitoring the first real simulated operating shift after onboarding, using the existing shift-start, connected-call and saved-case event bridge.

The panel records connected calls and actual saved inbound case references, QA scores, dispositions and compliance-breach flags. Two resolved cases with QA of at least 70/100 and no breach are needed for the first review. A low score, missing score or breach pauses qualification and requires a written coaching reflection. Earlier case evidence is retained.

The mentor sign-off is explicitly simulated. It does not certify a real employee, change production QA, salary, incentives, promotion eligibility or existing business rules. No Supabase migration, environment variable or API change is required; evidence is stored inside the existing onboarding record and saved through the existing CALLORIA profile save path.

## Preserve

Keep the existing `vite.config.js` except for the two additive lines above, `package.json`, `vercel.json`, `.env` files, Supabase configuration, `public/assets/`, GLB models, existing OJT runtime, first-shift gameplay plugin and all previous mobile/build repairs.
