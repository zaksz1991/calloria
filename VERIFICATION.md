# CALLORIA v6.38 Verification

- Regression suite: 122 tests passed, 0 failed (`node --test tests/*.test.mjs`).
- Build-plugin JavaScript syntax check: passed (`node --check build/calloria-cc0-staff-glb-bundle-plugin.mjs`).
- Existing v6.22–v6.37 regression coverage carried forward.
- New tests cover sequential multi-agent queue playback, mouth-event targeting, synchronous pause-before-start, resume, targeted queue clearing, direct-speech interruption, error recovery, 30-entry queue limit and queue-state reporting.
- Transform idempotence and fail-closed source-anchor checks: passed.
- Transformed runtime syntax validation: passed in regression suite.
- ZIP integrity: checked after packaging.

Not verified: a complete Vite production build, Vercel deployment, browser audio playback on the production site, or automatic invocation from the actual contact-handling UI. The UI must call `window.CalloriaStaffVoice.enqueue()` or `speak()`; this patch only extends the existing bridge.
