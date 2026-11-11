# Install CALLORIA v4.5.0 using GitHub Desktop

## Required baseline

Apply this overlay only after the v4.4.0 First Independent Working Shift package is already installed in `zaksz1991/calloria` and its Vite configuration, plugin and engine are present. The v4.4 package targeted the source shape at commit `74e0582`. This v4.5 package preserves the v4.4 integration and registers the outbound plugin after it.

Do not stack this patch on an unverified or structurally different `main.js`. The new plugin deliberately skips its transform if its v4.4 import or outbound save anchors do not match exactly once.

## Files to add

Copy these complete files into the matching repository folders:

- `build/calloria-outbound-campaign-v4-5-plugin.mjs`
- `js/outbound-campaign-engine.js`
- `tests/outbound-campaign-engine-v45.test.mjs`
- `tests/calloria-v45-outbound-plugin.test.mjs`

## File to replace completely

- `vite.config.js` — use the supplied complete merged configuration. It retains the existing GLB, office, supervisor, first-shift and OJT plugins, registers v4.4, then registers the v4.5 outbound campaign plugin after v4.4.

Do not replace `package.json` or `package-lock.json`.

## Do not replace

- `js/main.js`
- `build/calloria-first-working-shift-v4-4-plugin.mjs`
- `js/operational-conversation-engine.js`
- `build/calloria-ojt-runtime.js`
- `build/calloria-ojt-glb-activation-plugin.mjs`
- any GLB registry, GLB model, or anything under `public/assets/models/`
- recruitment, workforce, CRM, queue, digital-channel, voice or Supabase modules

## GitHub Desktop steps

1. Extract the ZIP in Windows File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the four new files into the matching `build`, `js` and `tests` folders.
5. Replace `vite.config.js` with the complete supplied v4.5 configuration.
6. Review the changed-file list. It should show one replaced Vite configuration and four new files.
7. Commit to `main` with the summary `CALLORIA v4.5.0 — outbound campaign operations` and push.
8. Inspect Vercel's full build log. Focused package tests are not a substitute for the full repository build.

## No backend migration or new environment variables

This overlay uses the existing browser save, campaign, callback, suppression and CRM record architecture. It requires no Supabase SQL migration, telephony account, AI key or additional Vercel environment variable.

## Browser acceptance checklist

1. Complete recruitment, product/service knowledge, CRM logging, experienced-agent shadowing, supervised practice, trainer sign-off and workstation allocation.
2. Attend the required briefing and start an independent shift.
3. Open Outbound and confirm the old multiple-choice script is replaced by the campaign operations desk.
4. Start a synthetic campaign contact. Confirm the customer opens and the response field accepts free text.
5. Attempt an incomplete introduction. Confirm the customer asks who is calling and why.
6. Identify the agent/organisation, explain the real campaign purpose and ask permission to continue.
7. Complete a regular interaction. Confirm after-contact work, disposition, CRM transcript, QA and outbound attempt history are saved.
8. Complete a busy/callback-request scenario. Confirm a future callback can be scheduled and cannot be resumed before it is due.
9. Resume the callback after its due time during an available shift. Confirm it creates a new outbound attempt linked to the callback.
10. Complete a do-not-contact scenario. Confirm the suppression register updates immediately and the same contact is blocked from a later campaign attempt, even if the active attempt is ended before wrap-up.
11. Complete a decline scenario. Confirm the customer decision is recorded without forcing a sale.
12. Confirm no real telephone call is placed and no real customer contact details are used.
13. Test the campaign and callback layouts on a physical mobile device.

## Verification boundary

The supplied v4.5 engine and plugin tests pass in isolation. A full repository `npm test`, full Vite production build, Vercel deployment, browser session, actual outbound telephony and physical-device test have not been performed by preparing this ZIP. The current patch is a synthetic gameplay upgrade, not a live dialler integration.
