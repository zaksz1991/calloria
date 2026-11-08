# CALLORIA v2.3 — First Shift Gameplay Loop

## Purpose

Turn the existing 3D movement/workstation flow into a guided first-shift objective connected to the real recruitment, briefing, shift, inbound-call and case wrap-up actions already implemented in `js/main.js`.

This is a focused gameplay bridge. It does not rebuild the 3D office, replace procedural geometry, replace GLB files, or change the existing business rules.

## Files

- Replace `vite.config.js` with the complete current-main configuration in this package. It preserves all existing multi-page entries and registers one additional post-transform plugin.
- Replace `js/world-gameplay-mission.js` with the mission HUD and event-driven progression.
- Add `build/calloria-first-shift-gameplay-plugin.js`.
- Add `tests/calloria-first-shift-gameplay.test.mjs`.

Do not replace `js/main.js`, `js/production-world.js`, existing GLB integration plugins, `package.json`, lockfiles, Supabase files or original model assets.

## What players see

The 3D floor displays a six-step first-shift guide:

1. Reach a workstation using MOVE; drag the scene to look; RUN sprints.
2. Tap USE when the workstation is in range.
3. Choose Inbound Desk.
4. Attend the active briefing and start the shift if the shift did not start automatically.
5. Accept the first waiting customer.
6. Complete after-contact work and save the case.

The guide advances only from actual application events. A case with an escalated or callback disposition is recorded accurately and is not labelled resolved.

The HUD also displays truthful GLB counts from the existing asset callback. If no GLB objects are confirmed, it explicitly says that procedural fallback is active.

## Build order

The new Vite plugin uses `enforce: 'post'` so it runs after the existing GLB, customer and supervisor transforms. It only transforms `js/main.js`, checks each expected source anchor exactly once, and refuses a partial transformation if the main source has changed.

## Verification

Run the repository's existing `npm test` and `npm run build` through the normal GitHub/Vercel workflow. The added test file is included automatically by the existing `node --test tests/*.test.mjs` script.

No live Vercel build or device-browser rendering has been performed from this package. Confirm the deployed build before treating the feature as live.
