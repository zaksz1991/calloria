# CALLORIA v6.83 — source scan notes

## Scope inspected

The scan reviewed the current public `main` branch files that control the phone launch/assessment state, immersive world lifecycle and GLB diagnostics:

- `performance-mobile.css`
- `js/main.js`
- `js/production-world.js`
- `build/calloria-glb-world-plugin.js`
- `build/calloria-ojt-glb-activation-plugin.mjs`
- `js/glb-asset-health-panel.js`
- `js/glb-asset-path-fallback.js`
- the Vite plugin registration in `vite.config.js`

## Confirmed findings

### P1 — two separate GLB diagnostic interfaces

`calloria-ojt-glb-activation-plugin.mjs` creates `#calloriaGlbAudit` inside `#immersiveHud`. Its `updateAudit` function sets `audit.hidden = false` and expands the details element when the report has no staff/office GLB placements or has failures. Its CSS places the card at the upper-left of the game HUD and gives it as much as 34vh on phones. This matches the oversized yellow-bordered panel in the provided screenshot.

The v6.82 runtime health report is a second UI surface. Before v6.83 its button was appended to `document.body` without being conditioned on immersive state. The result was redundant asset diagnostics and a control that could be present outside the 3D world.

### Confirmed lifecycle contract

The v6.82 `calloriaGLBWorldPlugin` transform dispatches `calloria:world-immersive` with `{ active: immersive }` from the world callback. `main.js` also adds/removes `body.calloria-game-playing` on world entry/exit. v6.83 uses both: the event for the primary path and the body class as a recovery observer.

### Assessment shell finding

The current `performance-mobile.css` already contains the v6.70 state rule: the launch screen is hidden in assessment and immersive-play states and shown only for the explicit launch state. It also contains single-column mobile assessment layout rules. The scan therefore did not repeat or rewrite that earlier fix; the remaining screenshot-specific overlap found in the current source was the duplicated GLB diagnostics overlay.

## Change boundary

v6.83 changes only the lifecycle and presentation of the diagnostics UI. It does not alter asset selection, file paths, loader retries, model validation, office placements or local fallback geometry. Those still require a real phone-browser GLB report and visible placement verification.
