# CALLORIA Supervisor Activation & Build Safety v1.9.1

## Purpose

The current `main` branch contains the supervisor intervention module and both Vite plugins, but `vite.config.js` does not register them. This overlay registers the supervisor world plugin and the supervisor case bridge. It also corrects the case bridge's generated dialogue string so the generated `main.js` contains an escaped `\\n` sequence rather than a literal line break inside a single-quoted string.

## Files

Replace these complete files:
- `vite.config.js`
- `build/calloria-supervisor-case-bridge-plugin.js`

Add:
- `tests/supervisor-activation.test.mjs`

Keep the existing files unchanged:
- `js/main.js`
- `js/production-world.js`
- `js/supervisor-intervention.js`
- `js/supervisor-intervention-core.js`
- `build/calloria-supervisor-intervention-plugin.js`
- `build/calloria-customer-world-plugin.js`
- `build/calloria-customer-avatar-plugin.js`
- `package.json` and lockfile
- all GLB assets and Supabase files

## Install

Merge the archive into the repository root. Replace the two listed files with the complete replacements. Add the test under `tests/`. Do not replace `package.json` or the lockfile.

## Run checks

The repository test command is `npm test`. The new focused test can also be run by the existing test glob. Then run the normal Vercel build.

## Expected behaviour

- Customer-world integration runs before supervisor intervention integration.
- The supervisor model loads only when a supervisor GLB has been approved in the Asset Inspector.
- A customer escalation queues the supervisor intervention.
- The supervisor case bridge records the review in the active Customer Intelligence Lab session and keeps mandatory QA review open.
- Existing original GLBs remain untouched.

## Verification boundary

The included focused tests validate plugin registration, preservation of the current multi-page build entries, bridge idempotence, anchor guards and JavaScript syntax of generated bridge output. They do not replace a full `npm test`, Vite production build, browser test or live deployment check against the repository's complete dependency tree.
