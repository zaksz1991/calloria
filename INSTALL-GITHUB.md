# Install CALLORIA v3.6.0 through GitHub Desktop

## Baseline

Target repository: `zaksz1991/calloria`  
Branch: `main`  
The current main branch must already contain the v3.5.1 file `build/calloria-first-working-shift-v3-5-plugin.mjs` and its import in `vite.config.js`.

## Replace/add files

1. Extract this ZIP in File Explorer.
2. Open the existing CALLORIA repository using GitHub Desktop and choose **Repository → Show in Explorer**.
3. Copy the contents of the extracted `CALLORIA_v3_6_Live_Inbound_Operations` folder into the repository root.
4. Replace `vite.config.js` completely with the supplied version.
5. Add `build/calloria-live-inbound-conversation-v3-6-plugin.mjs`.
6. Add `js/operational-conversation-engine.js`.
7. Add both supplied test files under `tests/`.
8. Add/replace the release documentation files.
9. Do not replace `js/main.js`, `index.html`, `package.json`, `public/`, existing 3D models, migrations or Supabase environment settings.
10. Confirm GitHub Desktop shows the expected changes, commit to `main`, and push.

Suggested commit summary: `CALLORIA v3.6.0 — live inbound customer operations`

## After push

1. Open the Vercel deployment for the new commit.
2. Confirm `npm install` and `npm run build` complete successfully.
3. Open the deployed app and use an already hired test profile.
4. Attend the applicable simulated operations briefing and start a shift.
5. Enter the inbound queue and accept a contact.
6. Confirm the inbound screen shows a customer/agent transcript and free-text reply form, not multiple-choice call-step cards.
7. Send a natural response. Confirm the customer replies with a persona-dependent branch.
8. Test customer speech playback where browser speech synthesis is available.
9. Complete a safe interaction and verify after-contact work, notes, disposition, QA, CSAT, CRM transcript and case history.
10. Test a prohibited credential request and confirm mandatory escalation.
11. Test hold/resume, supervisor request and specialist transfer.
12. Re-test the same flow on a physical mobile device.

Do not claim this milestone deployed until the Vercel build and browser acceptance checks pass.
