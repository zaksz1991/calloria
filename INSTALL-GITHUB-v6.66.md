# CALLORIA v6.66 — GUI installation

## Release package

Use `CALLORIA-v6.66-LIVE-OUTBOUND-OPERATIONS.zip` as a cumulative replacement snapshot built from the uploaded v6.65 source package. It contains the full source tree available in that package plus the v6.66 changes.

## GitHub Desktop / File Explorer

1. Download and extract the v6.66 ZIP.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Keep the repository's hidden `.git` directory. Do not delete it.
5. Copy the extracted release contents into the existing repository root and allow matching source files to be replaced.
6. Preserve your existing `public/assets/` folder and GLB models. The uploaded source snapshot did not contain `public/assets/`, so the v6.66 ZIP does not contain or replace that folder.
7. Review the changed files in GitHub Desktop. The principal v6.66 changes are `js/main.js`, `styles.css`, `package.json`, `vite.config.js`, `README.md`, `CHANGELOG.md`, `PRODUCT-ROADMAP.md`, the outbound UI regression test and release documentation.
8. Commit to `main` with message `CALLORIA v6.66 — live conversational outbound operations`, then select **Push origin**.

## Vercel

Keep the existing `calloria` Vercel project, connected GitHub repository, production domain, build settings and environment variables. A push to `main` should start the existing deployment if GitHub/Vercel integration is active. Do not change the Vercel root directory or environment variables for this release.

## Supabase

No Supabase migration or Edge Function deployment is required for v6.66. Do not change existing Supabase settings or secrets. Outbound campaigns remain local synthetic simulation data.

## Acceptance checks after deployment

1. Sign in or enter the existing guest/hired-player path that you normally use.
2. Complete the recruitment/employment gate when using a new profile; use an existing hired profile for direct operations testing.
3. Start a shift, open Outbound and start an eligible campaign.
4. Confirm the opening customer statement and campaign purpose appear in a transcript.
5. Enter an agent reply in your own words and send it. Confirm a customer response is added to the transcript.
6. Test Play customer voice and Request supervisor.
7. Complete the interaction and confirm the CRM/case record shows transcript, customer preference, decision, QA scorecards and the selected disposition.
8. Test an opt-out scenario and confirm the contact is suppressed and cannot be dialled again.
9. Test a compliance-breach scenario and confirm supervisor/compliance review is required.
10. Recheck the desktop and mobile layouts.

## Release limitations

The authoring environment had no installed `node_modules`, so a Vite production bundle was not run. The full suite contains 544 existing failures and is not fully green. The source-level comparison found no new failing test names in v6.66. No production deployment is claimed until Vercel reports a successful build.
