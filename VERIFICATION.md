# v6.37 Verification

- Regression suite: 116 tests passed, 0 failed (`node --test tests/*.test.mjs`).
- Build-plugin JavaScript syntax check: passed (`node --check build/calloria-cc0-staff-glb-bundle-plugin.mjs`).
- Transformed staff runtime syntax validation: passed through the included runtime transformation tests.
- Native speech bridge tests cover start/end lifecycle events, target asset IDs, voice selection, option bounds, stop/cancel behaviour, invalid payloads, unsupported browsers and preservation of an existing application API.
- Transform idempotence and fail-closed source-anchor handling: passed.
- ZIP integrity: checked after packaging.

Not verified: a complete Vite production build, a Vercel deployment, browser audio playback on the production site, actual agent-handler invocation, or the presence of jaw/viseme morphs in each production GLB. Browser voice inventory and output depend on the device/browser. The patch provides the API; the contact-handling UI still needs to call it.
