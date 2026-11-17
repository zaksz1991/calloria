# CALLORIA v6.62 — GUI Installation Guide

Target repository: `zaksz1991/calloria`  
Target Vercel project: `calloria`  
Production branch: `main`

## Preserve the existing repository

1. Keep the existing CALLORIA GitHub repository and Vercel project. Do not create a replacement project.
2. Keep the existing `.git` directory in the local checkout. Do not delete or replace it.
3. Keep the actual repository's `public/assets/` directory and its GLB models. The source ZIP supplied for v6.59–v6.61 did not include those binary assets; this release does not invent substitutes.
4. Keep any local environment files and existing production credentials out of the ZIP and Git commits.

## Install through GitHub Desktop / File Explorer

1. Download and extract `CALLORIA-v6.62-UNIFIED-AGENT-WORKLOAD.zip`.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the contents of the extracted release folder into the existing repository root. Do not copy an outer wrapper folder and do not delete `.git`.
5. Allow the included source, styles, tests, package scripts and documentation to merge/replace matching files.
6. Keep `public/assets/` from the actual GitHub checkout. The release ZIP has no `public/assets/` folder because it was absent from the supplied source snapshot.
7. Return to GitHub Desktop and review the changed-file list. Confirm these v6.62 files are present:
   - `js/agent-workload-engine.js`
   - updated `js/main.js`
   - updated `js/supervisor-queue-engine.js`
   - updated `styles.css`
   - `tests/agent-workload-engine-v662.test.mjs`
   - `tests/agent-workload-ui-v662.test.mjs`
   - updated `package.json`
   - `docs/CALLORIA-v6.62-UNIFIED-AGENT-WORKLOAD.md`
8. Use the commit summary `CALLORIA v6.62 — unified agent workload and digital concurrency` and commit to `main`.
9. Push the commit to GitHub. The existing Vercel integration should create the deployment if it remains connected.

## Vercel build settings

Keep the existing project settings:

- Framework: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x (project requires `>=22.12.0`)

No new Vercel environment variable is introduced by v6.62.

## Post-deployment acceptance

1. Start an employed agent's shift and open Digital Support.
2. Accept a live-chat contact. Confirm the agent moves to Busy.
3. While the first chat is active, accept a second eligible digital contact from the visible waiting queue.
4. Confirm the assigned-work tabs show both threads and switching tabs returns to the correct conversation.
5. Accept a third eligible digital contact. Confirm the global active digital count reaches 3/3.
6. Confirm any additional digital acceptance button is disabled with a capacity reason.
7. Record a reply on one contact. Confirm it moves to Awaiting Customer, remains on the assigned worklist, and frees one active slot.
8. Accept another eligible queue item. Confirm the agent can use the released slot.
9. Attempt to receive a customer follow-up while all active slots are occupied. Confirm it is blocked until a slot is released.
10. Complete a contact with disposition and factual case notes. Confirm a CRM case is created and the assigned-work tab disappears.
11. Open Supervisor Operations and confirm active digital work and awaiting-customer work are counted separately.
12. Repeat the worklist and queue controls at a phone viewport.

## Verification boundary

The package-level verification is recorded in `TEST-RESULTS-v6.62.txt` and `VERIFICATION-v6.62.md`. Those records distinguish focused regression tests and syntax checks from a full Vite production build, browser walkthrough and Vercel deployment. Do not treat a passing unit-test suite as proof that production deployment or live external provider connections have occurred.
