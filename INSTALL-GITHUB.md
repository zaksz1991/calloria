# CALLORIA v6.61 — GUI installation

This is a complete cumulative replacement for the supplied repository snapshot, retaining the previous v6.60 Supervisor Live Operations and v6.59 Live Queue Operations upgrades and adding v6.61 Automatic Multichannel Digital Demand. The uploaded source did not include `public/assets/` or its GLB binaries; they are not invented or silently substituted in this archive.

## Install with GitHub Desktop and File Explorer

1. Keep the existing `zaksz1991/calloria` GitHub repository and its existing Vercel project. Do not create a new project or change the root directory.
2. Make a backup of your current local `calloria` repository folder.
3. Extract `CALLORIA-v6.61-AUTOMATIC-MULTICHANNEL-OPERATIONS.zip` in File Explorer.
4. In GitHub Desktop, select the existing CALLORIA repository, then choose **Repository → Show in Explorer**.
5. Copy the extracted archive contents into the existing repository root. Allow matching source files to be replaced. **Do not copy a wrapper folder into the repository root. Do not delete the hidden `.git` folder.**
6. **Preserve the existing `public/assets/` directory and all GLB files from your real GitHub checkout.** The directory was absent from the uploaded ZIP used to prepare this release. Do not delete it or replace it with an empty folder. Other files that were present under `public/` in the upload are retained.
7. Keep the existing `.env` files, Vercel environment variables, Supabase settings, existing database schema and provider secrets. v6.61 adds no migration, secret, environment variable, dependency or external provider configuration.
8. Confirm the merged repository contains `js/digital-live-queue-engine.js`, updated `js/main.js`, `styles.css`, `package.json`, the updated package-manifest test, the two v6.61 tests and the v6.61 release documentation. The v6.60 supervisor engine/tests and v6.59 voice live-queue engine/tests must remain present.
9. In GitHub Desktop, review the changed-file list. Use commit message `CALLORIA v6.61 — automatic multichannel digital demand`, commit to `main`, then select **Push origin**.
10. Let the existing Vercel project build the updated `main` branch. Consider it deployed only after Vercel reports a successful production deployment.

## In-game acceptance checks

1. Open an existing hired profile or complete recruitment and accept the employment offer. Recruitment remains the entry gate; the primary gameplay remains employed agent work and career progression.
2. Start a new shift, open the Digital workspace and record the initial email, live-chat and social waiting counts.
3. Advance the accelerated in-game shift clock past the first due arrival for each channel. Confirm new fictional contacts appear on their respective queues without requiring manual batch creation.
4. Confirm each channel's arrival count increases independently and the displayed next-arrival estimate updates.
5. Leave a channel waiting queue at its configured capacity (email 18, live chat 14, social 16), then advance to the next scheduled arrival. Confirm the overflow count increases and no extra waiting contact is created.
6. Accept or resolve queued contacts and confirm they no longer consume waiting capacity.
7. Change the supervisor demand profile between Standard, Busy period and Recovery. Confirm future voice and digital arrival intervals change; existing contacts are not removed.
8. Pause voice intake using the supervisor control. Confirm voice arrivals pause but digital arrivals continue, as the pause control is deliberately scoped to voice intake.
9. Review the Digital event log, main operations timeline and supervisor demand snapshot. Confirm automatic arrivals and overflow events are visible.
10. Reload during an active shift and confirm the digital schedule and counters are restored without a catch-up burst of every missed arrival.
11. End the shift and confirm automatic digital intake stops. Start a new workday and confirm fresh schedules and counters.
12. Repeat on desktop and a phone-sized viewport. Actual mobile-device performance and visual rendering still require physical-device testing.

All digital contacts and outcomes are synthetic local game events. These acceptance checks do not send messages or connect to live email, social, chat or telephone providers.

## Verification

See `VERIFICATION-v6.61.md` and `TEST-RESULTS-v6.61.txt`. The 21 focused v6.61 tests and `npm run check` pass. The complete repository suite reports 1,835 tests, 1,291 passed and 544 legacy failures; no new failing test name is introduced compared with v6.60, and one older documentation-contract failure is resolved. `npm run build` cannot start in the preparation workspace because Vite is not installed (`vite: not found`). No successful Vercel deployment, browser walkthrough, external-provider connection or physical-device test is claimed.
