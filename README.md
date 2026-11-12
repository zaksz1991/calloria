# CALLORIA v6.10 — Mobile Responsive & Player Camera Repair

This is a focused repair for the root CALLORIA game page (`index.html`). It addresses the two problems shown in the submitted phone screenshots:

1. The player body/third-person model fills and blocks the mobile camera view.
2. The recruitment aptitude/practical Continue button is obscured or difficult to reach above the fixed bottom navigation dock.

It also adds a broader phone layout pass for cards, grids, forms, touch targets, safe areas, dialogs, tables, and the immersive touch controls.

## What changes

- Replaces `js/world-player-avatar.js` with a deliberately inactive first-person adapter. This does not disable NPC or office GLB assets; it disables only the unverified player-body mesh.
- Adds a final Vite post-transform after the existing world/OJT plugins. On touch devices, every immersive frame restores the eye-level camera position (`y = 1.68`) and hides the player avatar layer. The third-person follow-camera branch remains untouched for non-touch devices.
- Applies `calloria-mobile-responsive-v6-10.css` only to the main game root containing both `#worldCanvas` and `#viewRoot`.
- Adds `calloria-mobile-ui-guard-v6-10.js`, which observes the two assessment Continue actions and scrolls an enabled action row into view after the selected answer is rendered. It does not intercept or replace the application's click handlers.
- Reserves space above the fixed navigation, uses a sticky assessment action panel, and enlarges the answer and action hit areas.
- Uses the current `visualViewport` height to adapt to mobile browser chrome and orientation changes.

## Files and destinations

| ZIP file | Repository destination | Action |
|---|---|---|
| `vite.config.js` | `/vite.config.js` | Replace the prior v4.5-based config with this merged config, which preserves the known v4.5 plugin chain and adds the repair plugin last. |
| `build/calloria-mobile-responsive-repair-v6-10.mjs` | `/build/` | Add new file. |
| `js/world-player-avatar.js` | `/js/` | Add or replace the player-avatar module. |
| `public/calloria-mobile-responsive-v6-10.css` | `/public/` | Add new file. |
| `public/js/calloria-mobile-ui-guard-v6-10.js` | `/public/js/` | Add new file. |

Do not replace `js/production-world.js`, `js/main.js`, `styles.css`, any existing OJT/workstation runtime, or the `public/assets/models/` directory. The Vite plugin transforms the existing world source after the previous plugins have run.

The supplied `vite.config.js` is based on the latest complete config available in this working context (the v4.5 package). It keeps the established GLB/OJT, workstation, employment, and outbound plugin registrations. Any project-specific Vite edits made after that baseline must be merged before replacing the config.

## Expected result

- On phones and other coarse-pointer devices, the game uses a first-person view. The player body is not rendered in front of the camera.
- NPC/office GLB loading remains under the existing GLB/OJT pipeline. The player avatar is intentionally hidden until an actual model is proportionally fitted and visually approved.
- After a candidate selects an answer, an enabled Continue/Submit action is brought into view and remains above the bottom navigation dock.
- Assessment choices, Continue buttons, navigation, dialogs, forms, and touch controls receive larger usable tap areas.

## Scope limitations

This repair does not provide a full repository snapshot. It is an additive overlay with a complete Vite config based on the last available root configuration. The current full GitHub repository and production dependencies were not available in this workspace, so a production Vite build and live deployment could not be run. Real-device layout still needs confirmation after deployment. No changes are made to Supabase, AI credentials, gameplay scoring, recruitment answers, or customer data.
