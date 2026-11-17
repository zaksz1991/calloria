# CALLORIA v6.59 — GUI installation

This archive contains the cumulative CALLORIA source snapshot supplied for this upgrade, with v6.58 preserved and v6.59 live queue operations integrated. It does not contain the missing `public/assets/` folder or its GLB binaries.

## Install through GitHub Desktop and File Explorer

1. Keep the existing `zaksz1991/calloria` GitHub repository and Vercel project. Do not create a replacement project.
2. Make a backup of the current local `calloria` repository folder.
3. Extract `CALLORIA-v6.59-LIVE-QUEUE-OPERATIONS.zip` in File Explorer.
4. In GitHub Desktop, open the existing repository and choose **Repository → Show in Explorer**.
5. Copy the extracted archive contents into the existing repository root and allow matching source files to be replaced. Keep the hidden `.git` folder.
6. **Do not delete or replace an existing `public/assets/` folder.** It was not included in the supplied ZIP, so any GLB files already in your repository must be retained separately.
7. Keep the existing `.env`/Vercel environment variables and Supabase configuration. This upgrade adds no migration, secret or provider setting.
8. Review the changed-file list. It should include `js/live-queue-engine.js`, updated `js/main.js`, two new v6.59 tests, README/changelog and release verification documents. Existing v6.58 Try-It Studio files and Vite registration must remain.
9. Use commit message `CALLORIA v6.59 — live queue operations`, commit to `main`, then **Push origin**.
10. Let the existing Vercel deployment run. Do not treat the feature as deployed until the Vercel build finishes successfully.

## In-game acceptance checks

1. Open an existing hired profile or complete recruitment and accept the employment offer.
2. Start a working shift. The opening inbound contacts should appear in the existing queue.
3. Keep the shift active. The first automatic additional contact is expected after about 7.5 simulated minutes; the game clock runs at 30× speed, so this is about 15 seconds of wall-clock time.
4. Open **Inbound** and **Queue Control**. Confirm the waiting count, next-arrival estimate and arrival count update.
5. Accept the highest-priority waiting contact and complete its existing customer dialogue and wrap-up. Confirm accepted-contact and wait-time metrics continue to update.
6. Leave a low-priority contact waiting long enough to pass its simulated patience window. Confirm it leaves the waiting queue and increments the abandoned metric.
7. Use **Simulate demand surge (+6)** to add a controlled batch. Confirm the interaction timeline records the surge.
8. Confirm that queue growth is capped at 24 waiting contacts and overflow is recorded.
9. End the shift. Confirm automatic arrivals stop. Advance to a new workday and confirm a fresh queue schedule begins.

All contacts and outcomes are synthetic. The game feature does not place calls or contact real customers. The documented checks require a browser session; automated engine tests alone do not prove production playability.

## Verification status

See `VERIFICATION-v6.59.md` and `TEST-RESULTS-v6.59.txt`. A successful Vite production build, Vercel deployment, browser acceptance session and actual-device/mobile 3D rendering are not claimed by this source package.
