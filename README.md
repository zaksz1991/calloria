# CALLORIA v6.10.1 — Avatar Transform Build Compatibility Repair

## Cause of the failed Vercel build

The v6.10 repair package replaced `js/world-player-avatar.js` with a minimal first-person adapter. The existing `calloria-in-world-workstation-experience-v2-5` Vite plugin still transforms that file and requires four unique source anchors (animation pattern map, run-clip lookup, update signature and animation-selection expression). The replacement adapter removed those anchors, so the plugin stopped the build before Vite could finish.

## Repair

This patch restores the compatible pre-v6.10 avatar source from the CALLORIA v2.4 player integration. It contains each required v2.5 anchor exactly once.

The existing v6.10 post-transform plugin remains responsible for replacing the avatar module with its first-person-safe adapter at the end of the transform chain. Therefore the restored file is a build-time compatibility source; it does **not** re-enable the oversized third-person player mesh in the final v6.10 bundle.

## Installation

Replace only this repository file:

`js/world-player-avatar.js`

with the file at the same path inside this ZIP.

Do not replace `vite.config.js`, `production-world.js`, `main.js`, mobile CSS, the mobile UI guard, or any other file for this repair. Keep the v6.10 mobile repair plugin and its existing registration.

## Expected result

The v2.5 workstation plugin should find its four required anchors and stop failing on `animation pattern map (0 found)`. This addresses the exact failure in the supplied Vercel log.

## Verification boundary

- Required anchor counts: verified locally, each exactly one.
- Focused tests: included and run locally.
- JavaScript syntax: checked locally.
- ZIP integrity: checked locally.
- Full repository Vite build: not run because the current full repository source was not present in this workspace.
- Vercel build and Android device behavior: not verified.

The CC0 staff GLB warnings shown in the log (0/5 validated) are a separate asset-validation problem. They do not cause this particular build failure and are not changed by this patch.
