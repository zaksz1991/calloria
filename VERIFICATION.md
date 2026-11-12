# Verification — CALLORIA v6.12

## Executed checks

- `node --check build/calloria-cc0-staff-glb-bundle-plugin.mjs` — passed.
- Focused v6.12 tests — 9 passed, 0 failed.
- v6.11 mobile/avatar regression tests — 8 passed, 0 failed.
- Combined focused checks — 17 passed, 0 failed.
- ZIP integrity — checked after packaging.

The v6.12 fixtures cover:

- fully animated, 18-joint skinned character;
- skinned static-pose character with 13 joints and no clips;
- unskinned static-pose mesh;
- rejection of malformed GLB containers, external dependencies, implausible bounds and excess geometry;
- preservation of valid existing local assets without a network request;
- candidate-list filtering, manifest output and non-fatal offline download behaviour.

## Not executed

- Full CALLORIA Vite build against the latest GitHub `main` branch.
- Vercel deployment.
- Browser test of the five actual GLB files.
- Confirmation that the live 3D scene places each staff model.

The current repository source and the five actual GLB files were not available in this workspace. This release is a focused build-plugin repair, not a verified production deployment.
