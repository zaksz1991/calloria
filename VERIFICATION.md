# Verification — CALLORIA v6.6

## Checks performed

- `node --check public/live-floor.js` — passed.
- `node --check public/digital-channel-engine.js` — passed.
- JavaScript syntax checks for all JavaScript files in the delivered `public/` overlay — passed.
- v6.6 focused engine and controller integration tests — **34 passed, 0 failed**.
- v6.5 voice-engine and Live Floor regression tests against the updated HTML/JS/CSS — **28 passed, 0 failed**.
- Combined Node test run — **62 passed, 0 failed**.
- Static HTML ID uniqueness — no duplicate IDs.
- All static `$('#...')` controller selectors resolve to an HTML element — passed.
- Local static-server checks for `/live-floor.html`, `/live-floor.css`, `/live-floor.js`, `/digital-channel-engine.js` and the retained `/voice-call-engine.js` dependency — all HTTP 200.
- ZIP integrity — checked after packaging.

## Not verified

- Full CALLORIA repository test suite.
- Full Vite production build.
- Vercel deployment or live production route behaviour.
- End-to-end browser interaction or visual rendering. A local headless Chromium smoke attempt timed out in this environment, so browser rendering is not claimed as verified.
- Compatibility with locally customised dependencies that differ from the v6.5/v6.4/v6.3/v6.1 versions described in the README.

## Test boundary

The 34 v6.6 tests cover digital-channel engine rules and the Live Floor integration contract. The additional 28 regression tests verify the retained v6.5 voice workflow against the updated page/controller. Passing these tests does not establish that the full CALLORIA repository builds or that Vercel deployment succeeds.
