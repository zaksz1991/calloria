# CALLORIA v6.65 — GUI Installation Guide

**Release:** Adaptive Voice Customer Behaviour  
**Target repository:** `zaksz1991/calloria`  
**Production branch:** `main`  
**Target Vercel site:** `https://calloria.vercel.app`

## Preserve the existing project

This ZIP is a cumulative project source based on v6.64. It does not contain the repository's hidden `.git` directory, and the source archive used for this build did not contain `public/assets/` or the GLB files. Do not delete or replace those from your actual GitHub checkout. The other existing `public/` modules and project assets are included.

## Install with GitHub Desktop and File Explorer

1. Download and extract `CALLORIA-v6.65-ADAPTIVE-LIVE-INBOUND-VOICE.zip` using Windows File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Copy the extracted release contents into the existing repository root. Allow matching project files to be replaced. Keep the existing hidden `.git` folder and keep your actual `public/assets/` folder and its GLB models. Do not copy an outer wrapper directory into the repository.
5. Check that these files are present: `js/voice-customer-behaviour-engine.js`, `tests/voice-customer-behaviour-v665.test.mjs`, `tests/voice-customer-behaviour-ui-v665.test.mjs`, the updated `js/main.js`, `styles.css`, Vite plugin guard and v6.65 documentation.
6. In GitHub Desktop, review the changed-file list. The upgrade must not delete existing project folders, the `.git` directory or `public/assets/`.
7. Commit with summary: `CALLORIA v6.65 — adaptive voice customer behaviour`. Push to `main` only after reviewing the changes.
8. Allow the existing Vercel integration to build the pushed branch. The preparation environment did not have Vite installed, so deployment success is not assumed.

## Runtime acceptance checks after Vercel deployment

1. Open CALLORIA and use an existing hired profile. Confirm the recruitment entry gate and existing employment progression remain intact.
2. Start a simulated shift, open Inbound and accept a customer contact.
3. Confirm the live customer persona, opening statement and transcript appear.
4. Send both a guided response and a typed free-form response. Check that the customer reacts and sentiment / patience values change.
5. Test a dismissive response and confirm the customer interruption decision appears and blocks call progression until resolved.
6. Test a service-recovery conversation. Confirm the remedy is not treated as approved until authority is checked.
7. Test a prohibited request for a PIN, password, one-time code or payment security detail. Confirm a critical quality flag and supervisor assistance request are recorded.
8. Complete wrap-up and inspect the CRM case for sanitised transcript, customer persona, sentiment, quality flags, negotiation status and outcome.
9. Check the Supervisor workspace for the live voice risk indicators.
10. Repeat responsive layout and existing optional microphone consent flow on supported desktop and mobile browsers.

## External service and database requirements

- No Supabase migration or new secret is required for v6.65.
- No PBX, SIP, dialler, telephony provider or speech API is connected by this release.
- The existing optional browser recording / speech-recognition features remain governed by the existing explicit microphone-consent flow.

## Verification boundary

`npm run check` passed and the 24 new voice engine / UI tests passed. The full test suite still has 544 failures; these are the same failing test names as the v6.64 baseline. `npm run build` could not run in the preparation workspace because `vite` was not installed. No browser acceptance, GitHub push or Vercel deployment has been claimed. See `VERIFICATION-v6.65.md` and `TEST-RESULTS-v6.65.txt`.
