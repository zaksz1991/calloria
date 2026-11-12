# Verification — CALLORIA v6.5

## Checks performed

- `node --check public/voice-call-engine.js` — passed.
- `node --check public/live-floor.js` — passed.
- Focused Node test suite — **28 passed, 0 failed**.
- Voice-control element IDs and controller selectors — passed.
- Duplicate static HTML IDs — none found.
- Voice state, hold/resume, mute, supervisor consultation, warm transfer, persistence and wrap-up rules — covered by focused tests.
- ZIP archive integrity — checked after packaging.

## Not verified

- Full CALLORIA repository test suite.
- Full Vite production build.
- Vercel deployment or live route behaviour.
- Actual GLB/3D rendering.
- End-to-end browser interaction. A local headless Chromium smoke attempt timed out in this environment, so browser rendering is not claimed as verified.

## Test boundary

The 28 tests cover the new voice-call engine and static integration contracts for the Live Floor. They do not establish that the entire CALLORIA repository builds or that the patch is compatible with every locally modified copy of the required prior-version dependencies.
