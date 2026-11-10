# CALLORIA v3.7.1 — OJT/GLB Build Anchor Repair

## Failure addressed

Vercel build on GitHub `main` commit `12772ea` failed in `calloria-ojt-glb-activation-v3-7` because the plugin expected the complete original one-line `acceptOffer()` function. The earlier first-shift bridge inserts `calloria:game-employment-accepted` inside that function, so the original exact string no longer exists.

The v3.7 plugin also relied on pre-bridge GLB-status text and an inline 3D shift-start location that are owned or changed by earlier Vite plugins. Those are not stable integration points.

## What v3.7.1 changes

- Uses the stable `acceptOffer()` opening prefix and inserts onboarding state without overwriting the first-shift gameplay event or the rest of the employment acceptance logic.
- Preserves the first-shift GLB-ready callback and its staff/office counts and `calloria:glb-assets-ready` event instead of trying to rewrite an outdated callback body.
- Enforces OJT at the stable `open3dWorkView()` function entry.
- Routes inbound/outbound/digital desk selection through the existing shift and briefing rules. It removes a legacy inline `startShift()` call only when that call remains in the transformed source, preventing duplicate shift starts.
- Keeps the existing OJT curriculum, cross-industry choice, first-person player mode, Draco/Meshopt activation, low-tier office/staff GLB plan and compact HUD unchanged.

## Installation

Target: repository `zaksz1991/calloria`, branch `main`, baseline commit `12772ea`.

Replace only these files from the ZIP:

1. `build/calloria-ojt-glb-activation-plugin.mjs`
2. `tests/calloria-v37-onboarding-glb.test.mjs`

Keep the already-installed `build/calloria-ojt-runtime.js` from v3.7 unchanged. Do not replace `vite.config.js`, `package.json`, `js/main.js`, `index.html`, the prior gameplay plugins, existing 3D integration files or model assets.

Use GitHub Desktop or the GitHub website to commit the two replacements to `main`. Suggested commit message: `CALLORIA v3.7.1 — repair OJT integration anchors`.

## Verification boundary

The package test file contains nine focused tests. It exercises the updated main transform against a representative source shape after first-shift/workstation integration, including the injected employment event, existing GLB-ready telemetry callback and in-world workstation route.

This patch was syntax-checked and its nine focused tests passed in the patch workspace. It does not contain the full application repository. A full `npm test`, Vite production build, GitHub push, Vercel deployment, browser asset load and physical Android test have not been performed. A passing patch test is not evidence of a passing production build.
