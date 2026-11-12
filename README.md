# CALLORIA v6.11 — Mobile Interaction Hardening

This release builds on the v6.10 mobile repair and the v6.10.1 avatar-transform compatibility repair. It targets the two problems visible in the phone screenshots: the oversized player avatar obstructing the 3D camera and the recruitment Continue/Submit action being difficult to reach or tap above the fixed navigation.

## What this release changes

### Assessment navigation
- Adds a dedicated, fixed mobile assessment action bar above the bottom navigation.
- Mirrors the real `assessment-next` or `practical-next` button's enabled state and label.
- When tapped, the floating action bar clicks the original application button. Existing recruitment answer scoring and progression remain the application's responsibility.
- Hides the original footer visually only while the mobile proxy is active, preventing duplicate visible controls.
- Rebuilds the proxy after the assessment page re-renders each time an answer is selected.
- Accounts for browser chrome movement, orientation changes and safe-area insets.

### Mobile layout
- Further constrains assessment cards, grids, headings and answer rows to the viewport width.
- Keeps question text and answers readable without horizontal overflow.
- Provides a 52px action target for Continue/Submit.
- Reserves room for the persistent bottom navigation and fixed assessment action bar.
- Adds a compact landscape-phone arrangement.

### Player camera
- Restores the complete avatar source module containing all four exact transformation anchors required by the v2.5 workstation plugin. This addresses the build failure in the provided Vercel log.
- The final v6.11 Vite transform makes player presentation device-aware: phones use a first-person adapter and do not load the player body; desktop devices can still load the real agent GLB and v2.5 sitting/working/talking clips. NPC and office GLB loading remains separate.
- The touch camera guard is tolerant of whitespace changes in the v2.5 camera branch and warns rather than failing the build if the optional camera source anchor changes.

## Files and destinations

| ZIP file | Repository path | Action |
|---|---|---|
| `js/world-player-avatar.js` | `/js/world-player-avatar.js` | Replace; restores v2.5-required source anchors. |
| `js/world-player-avatar-desktop.js` | `/js/world-player-avatar-desktop.js` | Add; desktop-only real GLB avatar implementation with workstation motions. |
| `build/calloria-mobile-responsive-repair-v6-10.mjs` | `/build/calloria-mobile-responsive-repair-v6-10.mjs` | Replace; same exported function and filename used by the installed Vite config. |
| `public/calloria-mobile-responsive-v6-10.css` | `/public/calloria-mobile-responsive-v6-10.css` | Replace with v6.11 mobile layout rules. |
| `public/js/calloria-mobile-ui-guard-v6-10.js` | `/public/js/calloria-mobile-ui-guard-v6-10.js` | Replace with the floating assessment action proxy. |

No `vite.config.js` change is required. The existing config already imports `calloriaMobileResponsiveRepairPlugin` from the plugin file shown above. Do not replace `vite.config.js`, `js/main.js`, `js/production-world.js`, GLB/OJT runtimes, `styles.css`, Supabase files, or `public/assets/models/` for this release.

## Installation

In GitHub, replace the four existing files and add `js/world-player-avatar-desktop.js` at the exact paths in the table. Keep the surrounding folders and all other project files intact. The patch is an overlay, not a complete repository ZIP.

## Verification performed here

- Focused Node tests: 8 passed, 0 failed.
- JavaScript syntax checks: passed for the four JavaScript modules.
- CSS structural checks (PostCSS): passed.
- v2.5 avatar transform followed by the final v6.11 transform: passed.
- ZIP integrity: passed.

## Not verified

The complete production repository is not present in this workspace, so a full Vite build against the latest GitHub commit, Vercel deployment, and physical Android browser interaction were not run. The Vercel error's four missing v2.5 anchors are present in the included source file, but only the next actual Vercel build can confirm the full chain passes.

The separate staff asset issue from the supplied build log remains: the v3.9 bundle reported 0/5 validated staff GLBs. This release does not relax model-validation rules or claim those staff/office GLBs are loading. The asset pipeline needs a separate model compatibility repair based on the actual GLB files and runtime checks.
