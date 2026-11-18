# CALLORIA v6.67 — GUI installation guide

## Release

**Release:** v6.67 — Campaign Contact Worklists & Dialler Retry Governance  
**Target repository:** `zaksz1991/calloria`  
**Production branch:** `main`  
**Production site:** `https://calloria.vercel.app`

This is a cumulative source upgrade built from the supplied v6.66 archive. It keeps the existing recruitment entry gate and the main agent-work / career-progression gameplay. All campaign contacts and dial results remain fictional local simulation records.

## 1. Back up the existing repository

1. Keep a copy of the current repository checkout before replacing files.
2. Keep the hidden `.git` directory. It contains the existing GitHub connection and commit history.
3. Keep your actual `public/assets/` directory and all approved GLB models. The source ZIP used for this release did not contain `public/assets/`; this release does not include or replace those assets.

## 2. Merge the cumulative release using File Explorer

1. Download and extract `CALLORIA-v6.67-CAMPAIGN-WORKLISTS-DIALLER-GOVERNANCE.zip`.
2. Open the existing `zaksz1991/calloria` checkout in GitHub Desktop.
3. In GitHub Desktop, select **Repository → Show in Explorer**.
4. Copy the contents of the extracted release folder into the existing repository root. Do not copy an outer wrapper directory.
5. Allow the included source files to replace matching files. Keep the existing `.git` folder and `public/assets/` folder untouched.
6. Confirm the repository contains the new files:
   - `js/campaign-operations-engine.js`
   - `tests/campaign-operations-engine-v667.test.mjs`
   - `tests/campaign-operations-ui-v667.test.mjs`
   - `INSTALL-GITHUB-v6.67.md`
   - `VERIFICATION-v6.67.md`
   - `TEST-RESULTS-v6.67.txt`
7. Review the changed files in GitHub Desktop. The merge also updates `js/main.js`, `styles.css`, `package.json`, `tests/package-manifest.test.mjs`, `README.md`, `CHANGELOG.md` and `PRODUCT-ROADMAP.md`.
8. Use the commit summary `CALLORIA v6.67 — campaign worklists and dialler retry governance`.
9. Select **Commit to main**, then **Push origin**.

## 3. Vercel settings

Keep the existing Vercel project and domain. The existing Vite configuration remains:

- Framework preset: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x or later (the project declares Node `>=22.12.0`)

Do not create a new Vercel project or change the production domain for this release. The source-level check passed, but a production bundle could not be run in the preparation environment because Vite was not installed. Treat the Vercel result as pending until the deployment log confirms dependency installation and `vite build` succeed.

## 4. No Supabase changes required

This release uses the existing browser-local save structure and the existing campaign/CRM simulation flows. It adds:

- No Supabase migration.
- No new Edge Function.
- No new secret or environment variable.
- No external dialler or telephone provider.
- No new npm dependency.

Do not run database migrations for v6.67.

## 5. Post-deployment gameplay checks

Use an already hired agent profile and start an active shift.

1. Open **Outbound** and confirm each campaign displays a worklist of eight fictional contacts.
2. Confirm the first contact retains the customer from the original campaign template and additional contacts have stable synthetic names/IDs.
3. Start a contact. Confirm the agent becomes busy and the worklist records the attempt number, contact ID, attempt reference and owner.
4. For an answered result, confirm the v6.66 live customer transcript and free-form response workflow still opens.
5. For no answer, busy or voicemail, confirm no customer conversation is created. Record the outcome in after-contact work.
6. Confirm the contact enters the correct cooling-off state: 15 minutes for no answer, 30 minutes for busy or 120 minutes for voicemail.
7. Confirm the contact cannot be redialled before its retry due time and cannot exceed three attempts.
8. Request a customer callback during an answered conversation. Confirm the due date must be in the future and the callback remains linked to the same campaign contact.
9. Confirm a callback cannot be resumed before its due time and must be resumed from the callback control when due.
10. Confirm opt-out records suppression; completed, declined, review-required and exhausted contacts cannot be redialled.
11. Reload the browser and verify the saved worklist and attempt history remain present.
12. Re-check the existing recruitment gate, inbound queue, digital queues, voice customer conversation and CRM screens for regressions.
13. Test the layout at desktop and phone widths.

## Verification boundary

The recorded v6.67 checks are in `VERIFICATION-v6.67.md` and `TEST-RESULTS-v6.67.txt`. The Node syntax check and new focused tests passed. The full test suite still has the same 544 failing test instances and the same 526 distinct failing test names as the v6.66 baseline; no new failing test names were found. The Vite production build, live browser gameplay and Vercel deployment remain unverified.
