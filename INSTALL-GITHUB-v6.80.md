# CALLORIA v6.80 — Mobile state and 3D viewport repair

**Target repository:** `zaksz1991/calloria`  
**Production branch:** `main`  
**Production site:** `https://calloria.vercel.app`

## Scope

This is an updated-files overlay for the current public `main` source. It is not a full repository replacement and does not include or replace the existing GLB asset directory.

It addresses three faults visible in the supplied phone screenshots:

1. The launch hero can remain visible after the app has left launch mode. The new state rule only displays `#gameLaunchScreen` while `body.calloria-game-launch` is active. This prevents the launch copy from stacking over the normal Home / recruitment interface.
2. The immersive world can stop rendering if its `IntersectionObserver` marks the canvas as outside the viewport during the transition to a fixed, full-screen phone layout. The runtime guard keeps the world canvas visible to that observer while immersive mode is active and re-notifies the existing observer when the mobile viewport changes.
3. The GLB diagnostic card was taking up a large part of the phone play area. It is hidden on phone/touch layouts. The full diagnostic page remains available at `/asset-inspector.html`.

The overlay also recalculates the visible browser height, sizes the world canvas to that height, compacts the touch controls with safe-area spacing, and removes the desktop-only GRAPHICS toggle from the phone HUD so it cannot collide with EXIT GAME. The adaptive graphics profile remains active.

## Installation using GitHub Desktop and File Explorer

1. Back up the current local `calloria` repository folder.
2. Download and extract `CALLORIA-v6.80-MOBILE-WORLD-REPAIR.zip`.
3. Open the existing `zaksz1991/calloria` checkout in GitHub Desktop and select **Repository → Show in Explorer**.
4. Copy the supplied `index.html` into the repository root and replace the existing file.
5. Merge the supplied `public` folder into the repository's existing `public` folder. Add the two new v6.80 files and do not remove other public files.
6. Keep the hidden `.git` folder, `public/assets/`, all GLB files, Supabase configuration, environment files and every other existing project file.
7. Add `tests/calloria-mobile-world-v680.test.mjs` under the existing `tests` folder.
8. Review the changed-file list. It should show `index.html` plus the two new files under `public/` and the new focused test/documentation files.
9. Commit with summary `CALLORIA v6.80 — mobile app-state and immersive viewport repair`, then select **Push origin**.
10. Wait for the existing Vercel deployment to finish and confirm it reports **Ready** before testing the live site.

## Post-deployment phone checks

1. Open `https://calloria.vercel.app` on the same phone. Confirm only one home/launch surface is visible; the launch hero must not overlap the Home or recruitment content.
2. Open a candidate profile and complete the aptitude flow. Confirm the current assessment and result view are the only visible application surface.
3. Start the 3D workplace. Confirm the canvas fills the visible phone viewport and the floor renders rather than a blank gradient.
4. Rotate the phone and show/hide the browser address bar. Confirm the 3D canvas resizes without leaving a blank or clipped region.
5. Confirm joystick, Run and Use stay within the bottom safe area and do not cover the exit control. The desktop-only GRAPHICS control should not overlay the EXIT GAME button on touch devices.
6. Open `/asset-inspector.html` separately to inspect GLB file status. Hiding the diagnostic card does not mean the GLB assets have loaded.
7. Exit the 3D world and confirm the normal application interface returns without the launch hero remaining on top.

## Verification boundary

The included focused Node tests check the state selector, script ordering, touch layout rules and observer recovery contract. JavaScript syntax and those tests are verified in the release workspace. This environment did not run the full Vite production build, deploy to Vercel, or perform a physical Android/iOS browser run. The GLB diagnostic shown in the screenshots reported zero loaded staff and office models; this release does not claim to repair the underlying GLB loading/placement count. It removes that developer panel from the phone play surface and preserves the standalone inspector for diagnosis.
