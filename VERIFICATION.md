# Verification — CALLORIA v6.4

## Passed

- `node --check public/customer-dynamics-engine.js`
- `node --check public/live-floor.js`
- Focused unit and integration suite: **15 passed, 0 failed**.
- Full contact-flow integration exercised the existing base shift, agent, customer journey and live-floor engines.
- Supervisor-support evidence was verified in the completed contact record.
- Duplicate HTML IDs: **none** (97 static IDs checked).
- Live Floor controller selector contract: **91 selectors checked, 0 missing**.
- HTML script load order checked: base live-floor engine → customer dynamics extension → live-floor controller.
- ZIP archive integrity checked after packaging.

## Not verified

- Full CALLORIA repository test suite.
- Full Vite production build.
- Vercel deployment or production URL behaviour.
- Browser visual/end-to-end testing on desktop or mobile.
- Real multi-user supervisor notification or Supabase synchronisation.

## Test scope

The included integration fixtures reproduce the v6.0-compatible engines retained by the v6.3 stack. They verify the v6.4 extension contract and a complete synthetic contact flow. They do not prove that the current GitHub repository or deployed website has been updated.
