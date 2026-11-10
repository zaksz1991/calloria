# CALLORIA v3.7.0 verification record

## Checks run in the patch workspace

- `node --test tests/calloria-v37-onboarding-glb.test.mjs`: **9 passed, 0 failed**.
- `node --check build/calloria-ojt-glb-activation-plugin.mjs`: passed.
- `node --check build/calloria-ojt-runtime.js`: passed.
- `node --check vite.config.js`: passed.

The focused tests cover decoder registration, the low-tier office asset plan, shared customer/office loader decoding, low-tier stationary staff candidates, first-person-only avatar adapter, cross-industry post-hire onboarding, sequential training gates, compact HUD injection and decoder file list.

## Repository-source checks

The plugin has been prepared against public repository source at commit `96649f9`. The existing GLB registry references first-party paths under `/assets/models/`; the six primary agent/office/headset/reception paths were checked against the raw GitHub repository and returned binary-content responses. The patch adds a build-time existence check for these exact files.

## Not run / not claimed

- Full repository `npm test`.
- Full Vite production build.
- A new Vercel deployment.
- Visual inspection of the downloaded GLB binaries, their geometry, rig quality, animation clips or license records.
- Live browser load of every GLB path or confirmation that runtime geometry passes the existing budgets.
- Desktop/Android/iOS visual QA, mobile FPS profiling or touch-control verification.
- End-to-end test of recruitment, all OJT screens, sign-off, briefing, workstation access and customer operations on the deployed site.
- GitHub commit/push or any production deployment.

The patch is prepared, not deployed. A 9/9 focused plugin test result does not establish that the full repository compiles or that the assets render correctly in Vercel/browser.
