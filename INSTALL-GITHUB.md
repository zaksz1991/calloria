# Install CALLORIA v4.4.0 using GitHub Desktop

## Before applying

This overlay targets the public repository source baseline at commit `74e0582` and assumes the previously installed OJT/workstation allocation runtime is retained. Do not apply it over a newer, structurally changed `main.js` without reconciling the integration anchors first.

## Files to add

Copy these complete files into the matching repository locations:

- `build/calloria-first-working-shift-v4-4-plugin.mjs`
- `js/operational-conversation-engine.js`
- `tests/operational-conversation-engine-v44.test.mjs`
- `tests/calloria-v44-first-working-shift-plugin.test.mjs`

## File to replace completely

- `vite.config.js` — use the complete file supplied in this package. It preserves the currently registered GLB, office, supervisor, first-shift and OJT plugins, then registers the v4.4 live-shift plugin after the OJT/GLB plugin.

## Do not replace

- `package.json` or `package-lock.json`
- `js/main.js`
- `build/calloria-ojt-runtime.js`
- `build/calloria-ojt-glb-activation-plugin.mjs`
- any existing GLB model or anything under `public/assets/models/`
- existing recruitment, CRM, queue, workforce, voice or Supabase modules

## GitHub Desktop steps

1. Extract the ZIP in Windows File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the four new files into their matching `build`, `js` and `tests` folders.
5. Replace `vite.config.js` with the complete supplied file.
6. Return to GitHub Desktop and inspect the changed-file list. It should show one replaced config, one new build plugin, one new engine and two new tests.
7. Commit to `main` with the summary `CALLORIA v4.4.0 — first independent shift gameplay` and push.
8. Inspect the Vercel deployment log. A successful focused test run is not a substitute for the production build.

## No backend migration

This patch uses the existing client-side simulation/save architecture. It requires no Supabase SQL migration and no new environment variables.

## Browser acceptance checklist

After a successful build/deployment:

1. Complete recruitment and accept an employment offer.
2. Complete product/service knowledge, CRM logging, experienced-agent shadowing and supervised practice.
3. Receive simulated trainer sign-off and workstation allocation.
4. Attend the correct operations briefing and start the shift.
5. Open Inbound and accept a queued customer.
6. Confirm the inbound screen shows a conversation transcript and a free-text response box rather than answer-choice buttons.
7. Send several agent responses and verify that the synthetic customer replies and patience/QA figures change.
8. Test hold/resume and supervisor assistance.
9. Complete a conversation, enter factual wrap-up notes and save the disposition.
10. Open CRM and verify the case contains the conversation transcript and scorecards.
11. Repeat with a non-banking scenario to confirm that general customer care and other industries remain supported.

The browser and Vercel checks above have not been performed by preparing this ZIP.
