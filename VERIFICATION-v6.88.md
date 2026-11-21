# CALLORIA v6.88 — verification report

## Automated regression suite

Command used in the isolated patch workspace: `node --test tests/*.test.mjs`

- Tests passed: **67**
- Tests failed: **0**
- Tests skipped: **0**

The suite includes the carried-forward v6.81–v6.87 path fallback, GLB startup/diagnostics, third-person transform and RuffNeck service-operation checks, plus v6.88 tests for inbound-to-QA transcript mapping, credential redaction, human QA coaching, competency calculations, guided practice, coach sign-off paths, scenario scoring, plugin ordering and transformed-source syntax.

## Syntax checks

Passed `node --check` for every supplied `.js` and `.mjs` file under `build/` and `js/`, the career plugin and `vite.config.js`.

Passed a JavaScript parse check of the transformed focused `main.js` source fixture using the current literal source anchors audited at commit `c8a48d6`.

## Archive integrity

The final ZIP was tested after creation with `unzip -t`; no corrupt entries were reported. The final ZIP SHA-256 is supplied in the delivery message.

## Not verified

- Full repository `npm run build` / Vite production build.
- Vercel deployment or browser runtime.
- Live Supabase guest/cloud save persistence for the new `careerPathway` property.
- Phone/Android/iOS screen testing.
- Downloading or placing actual GLB staff and office assets in the deployed scene.

The archive is a cumulative overlay, not a complete repository replacement. These verification limits are intentional and should not be represented as a successful production build.
