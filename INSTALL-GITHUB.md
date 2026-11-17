# CALLORIA v6.60 — GUI installation

This is a complete cumulative replacement for the exact `calloria.zip` repository snapshot supplied for the upgrade. It includes the saved v6.59 Live Queue Operations changes and the new v6.60 Supervisor Live Operations Command Centre. It does not contain the `public/assets/` folder or GLB binaries omitted from the uploaded source snapshot.

## Install through GitHub Desktop and File Explorer

1. Keep the existing GitHub repository `zaksz1991/calloria` and Vercel project. Do not create a replacement project.
2. Make a backup of the current local `calloria` repository folder. The original uploaded snapshot was separately preserved before this release.
3. Extract `CALLORIA-v6.60-SUPERVISOR-LIVE-OPERATIONS.zip` in File Explorer.
4. In GitHub Desktop, open the existing repository and choose **Repository → Show in Explorer**.
5. Copy the extracted archive contents into the existing repository root. Allow matching source files to be replaced. Keep the hidden `.git` folder.
6. **Do not delete or replace an existing `public/assets/` folder.** It was not included in the supplied upload; retain all GLB files already present in the actual repository checkout. Other files under `public/` that were present in the uploaded source are included in the upgrade archive.
7. Keep the existing `.env`/Vercel environment variables and Supabase project configuration. v6.60 adds no migration, provider secret or environment setting.
8. Review the changed-file list. It should include `js/supervisor-queue-engine.js`, updated `js/live-queue-engine.js`, `js/main.js`, `styles.css`, updated `package.json` and its package-manifest test, plus the two new v6.60 tests and release documentation. The previous v6.59 live-queue files and v6.58 Try-It Studio files must remain.
9. Use commit message `CALLORIA v6.60 — supervisor live operations command centre`, commit to `main`, then **Push origin**.
10. Let the existing Vercel project build the updated `main` branch. Treat the upgrade as deployed only after Vercel reports a successful production deployment.

## In-game acceptance checks

1. Open an existing hired profile or complete recruitment and accept the employment offer. Recruitment remains the entry gate; this upgrade does not replace agent gameplay with a quiz.
2. Start an active working shift and open **Supervisor** from the operations navigation.
3. Confirm the supervisor board reports waiting voice and digital work, service-risk counts, open assistance requests and escalated cases.
4. Enter a reason of at least four characters and select **Pause new arrivals**. Confirm automatic inbound voice arrivals pause while the shift remains active.
5. Leave a low-priority waiting voice contact in the queue long enough to pass its simulated patience threshold. Confirm it can still abandon while intake is paused.
6. Enter a reason and resume arrivals. Confirm the next expected arrival estimate returns.
7. Change the demand profile to **Busy period**, then **Recovery**. Observe that busy mode shortens future arrival intervals and recovery lengthens them. These profiles affect future synthetic inbound voice arrivals only.
8. Change priority and route group for a waiting voice contact. Enter a reason and save. Confirm the changed values, contact timeline entry and supervisor audit record.
9. Repeat triage for a waiting email/live-chat/social contact. Confirm active or completed work cannot be triaged as waiting work.
10. Review the supervisor audit trail and operations activity. Resolve any open assistance request and confirm the request closes.
11. End the shift, advance to the next simulated workday and confirm intake resets to Standard/Open while saved audit history remains.
12. Repeat on a phone-sized browser viewport to check that the control buttons and triage forms remain usable.

All contacts, arrivals, queue states and outcomes are fictional local simulation data. Intake controls do not control a real telephone network, dialler, email provider, social inbox or external staff team.

## Verification status

See `VERIFICATION-v6.60.md` and `TEST-RESULTS-v6.60.txt`. The focused release checks report 66 passed. `npm run check` passes. The full suite reports 1,814 tests, 1,269 passed and 545 existing failures; the set of 527 distinct failing test names is unchanged from the v6.59 baseline. The Vite production build could not start in the preparation environment because dependencies were not installed (`vite: not found`). A successful Vercel deployment, browser acceptance session and actual-device 3D rendering are not claimed.
