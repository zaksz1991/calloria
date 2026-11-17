# CALLORIA v6.64 — GUI Installation Guide

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Existing Vercel project:** `calloria`  
**Release archive:** `CALLORIA-v6.64-ADAPTIVE-DIGITAL-CUSTOMER-BEHAVIOUR.zip`

## Preserve the existing project

1. Use the existing `zaksz1991/calloria` repository and existing Vercel project. Do not create a replacement project.
2. Keep the hidden `.git` directory.
3. Keep the real `public/assets/` directory and all approved GLB models from your GitHub checkout. The uploaded repository snapshot used for this release did not include `public/assets/`; this release does not create substitute assets.
4. Preserve existing `.env` files, Supabase configuration, Vercel settings, credentials and any uncommitted work.
5. The archive is a cumulative snapshot of the supplied current source tree plus v6.64. Review the changed-file list before committing.

## Install using GitHub Desktop and File Explorer

1. Download and extract `CALLORIA-v6.64-ADAPTIVE-DIGITAL-CUSTOMER-BEHAVIOUR.zip`.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Copy the contents of the extracted archive into the existing repository root. Merge folders and allow updated source files to replace matching versions.
5. Do not delete `.git`, `public/assets/`, `.env` files or any local configuration.
6. Confirm the following release files are present:
   - `js/digital-customer-behaviour-engine.js`
   - updated `js/main.js`
   - updated `js/supervisor-queue-engine.js`
   - updated `styles.css`
   - `tests/digital-customer-behaviour-v664.test.mjs`
   - `tests/digital-customer-behaviour-ui-v664.test.mjs`
   - `tests/supervisor-customer-behaviour-v664.test.mjs`
   - updated `package.json` syntax-check list
   - `docs/CALLORIA-v6.64-ADAPTIVE-DIGITAL-CUSTOMER-BEHAVIOUR.md`
   - `VERIFICATION-v6.64.md` and `TEST-RESULTS-v6.64.txt`
7. Review the changed-file list in GitHub Desktop. Use commit summary `CALLORIA v6.64 — adaptive digital customer behaviour` and commit to `main`.
8. Push to GitHub. The existing Vercel integration should build the same project if it remains connected.

## Existing Vercel configuration

Keep the current settings:

- Framework preset: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x or later (`>=22.12.0` in the package manifest)

No new Vercel environment variable, Supabase migration, Edge Function or secret is required by v6.64.

## Post-deployment acceptance

1. Start an employed agent shift and open Digital Support.
2. Accept a synthetic email, live-chat or social contact.
3. Confirm the Customer Behaviour Monitor shows a stable persona, mood, sentiment, patience and turn count.
4. Send a professional response with acknowledgement, ownership and a clear next step. Confirm the simulated customer reaction updates.
5. Receive the prepared customer response. Confirm the message differs according to the persona and the thread returns to active work.
6. Send a weak or dismissive response in a separate test contact. Confirm sentiment/patience can deteriorate and that the supervisor recommendation appears when the configured risk threshold is reached.
7. Request supervisor assistance and confirm it appears in Supervisor Operations.
8. Confirm the supervisor Customer Emotion Watch counts open at-risk digital contacts and ranks the lowest sentiment first.
9. Complete a contact and inspect the synthetic CRM case record for customer persona, mood and sentiment fields.
10. Repeat at desktop and phone widths. Confirm existing first-response SLA, voice queue, multichannel concurrency, CRM, QA and career progression still work.

## Verification boundary

The `npm run check` syntax gate and automated test results are recorded in `TEST-RESULTS-v6.64.txt`. The full suite still contains the same 544 pre-existing failure instances (526 distinct failing test names) as the v6.63 baseline. A Vite production bundle, browser playthrough, physical mobile-device check and Vercel deployment have not been verified in the preparation environment.
