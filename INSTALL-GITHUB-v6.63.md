# CALLORIA v6.63 — GUI Installation Guide

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Vercel project:** existing `calloria` project  
**Release:** `CALLORIA-v6.63-DIGITAL-FIRST-RESPONSE-SLA.zip`

## Preserve the existing project

1. Work in the existing `zaksz1991/calloria` repository and existing Vercel project. Do not create a replacement application.
2. Keep the hidden `.git` directory. Never delete it or replace it with the ZIP contents.
3. Keep the actual `public/assets/` directory and all approved GLB models from the existing GitHub checkout. The source archive used for this release did not contain `public/assets/`; this package does not manufacture substitute GLB files.
4. Preserve local environment files and all existing Supabase/Vercel credentials. The release contains no new secrets or environment variables.
5. Keep any uncommitted user changes. Review the changed-file list before committing.

## Install with GitHub Desktop and File Explorer

1. Download and extract `CALLORIA-v6.63-DIGITAL-FIRST-RESPONSE-SLA.zip`.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Copy the contents of the extracted release folder into the existing repository root. Merge the folders and allow updated source files to replace their matching versions. Do not copy an extra outer folder into the repository root.
5. Do not delete `.git`, `public/assets/`, `.env` files or other local configuration.
6. Check that these v6.63 release files are present:
   - `js/digital-sla-engine.js`
   - updated `js/main.js`
   - updated `js/supervisor-queue-engine.js`
   - updated `styles.css`
   - `tests/digital-sla-engine-v663.test.mjs`
   - `tests/digital-sla-ui-v663.test.mjs`
   - `tests/supervisor-sla-integration-v663.test.mjs`
   - updated `tests/package-manifest.test.mjs`
   - updated `package.json`
   - `docs/CALLORIA-v6.63-DIGITAL-FIRST-RESPONSE-SLA.md`
   - `VERIFICATION-v6.63.md` and `TEST-RESULTS-v6.63.txt`
7. Review the source changes in GitHub Desktop. Use the commit summary `CALLORIA v6.63 — digital first-response SLA control` and commit to `main`.
8. Push to GitHub. Let the existing Vercel integration build the same project.

## Vercel settings

Keep the existing Vercel project configuration:

- Framework preset: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x (the project specifies `>=22.12.0`)

No new Vercel environment variable is required by this release. No Supabase migration or Edge Function deployment is required.

## Post-deployment acceptance

1. Start an employed agent shift and allow synthetic email, live-chat and social demand to arrive.
2. Confirm a new contact shows its first-response target and remaining time.
3. Advance the simulated shift clock until 75% of the target has elapsed. Confirm the contact enters Due soon and the risk event appears once in the timeline.
4. Advance beyond its deadline without replying. Confirm the contact shows SLA breached and the breach event appears once.
5. Reply to a different contact before its deadline. Confirm it records Met target and stops the first-response timer.
6. Reply to a contact after the deadline. Confirm it remains recorded as First response late; it must not be reset to Met target by later customer follow-ups.
7. Open another assigned digital thread and confirm its status is shown on the assigned-work tab and active conversation panel.
8. Open Supervisor Operations. Confirm the Digital SLA Breaches tile and waiting queue status match the same agent queue records.
9. Confirm existing voice queue, intake controls, concurrent digital capacity, CRM case creation, QA and career progression still behave as before.
10. Repeat the agent and supervisor checks at desktop and phone widths.

## Verification boundary

Package-level test and syntax results are in `TEST-RESULTS-v6.63.txt` and `VERIFICATION-v6.63.md`. The Vite production build, browser walkthrough, physical-device checks and Vercel deployment were not verified in the preparation environment. Do not treat the package test results as proof of a successful production deployment.
