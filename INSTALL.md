# Installation — CALLORIA v2.7

Merge the extracted ZIP into the existing `calloria` repository.

## Replace
- `vite.config.js` (complete replacement; preserves the existing plugin registrations and build entries, and adds the v2.7 staff compatibility plugin).

## Add
- `build/calloria-static-glb-staff-plugin.mjs`
- `tests/calloria-static-glb-staff.test.mjs`

Do not replace `main.js`, `production-world.js`, `package.json`, the GLB registry, or any original `.glb` files.

## Runtime behaviour
- Valid static GLBs can replace standing staff.
- Embedded animation clips remain preferred.
- Rig-aware idle remains supported.
- Static-only GLBs are never used for seated employees. Seated employees still require an actual seated/typing clip or a separately verified seated pose.
- The existing procedural staff remains the fallback if a candidate fails scale, geometry, texture or extension checks.

## Verification
The included test file uses Node's built-in test runner. The focused tests cover plugin registration, static standing replacement, seated safety, animation priority, idempotence and stale-source protection. A full Vercel build and real-phone rendering must still be verified in the user's deployment; this package does not claim either has already passed.
