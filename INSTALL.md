# CALLORIA v6.70 — Mobile layout and state repair

## Exact target

- Existing repository: `zaksz1991/calloria`
- Existing production site: `https://calloria.vercel.app`
- Target file: `performance-mobile.css` at the repository root

This package contains a **complete replacement for `performance-mobile.css` only**. It preserves the 241-line public `main` stylesheet baseline and adds the v6.70 state-boundary, aptitude-screen and immersive-touch corrections. It is not a complete repository archive.

## Install with GitHub Desktop / File Explorer

1. Back up the current repository folder.
2. Extract this ZIP.
3. Open the existing CALLORIA repository in GitHub Desktop and select **Repository → Show in Explorer**.
4. Copy the supplied `performance-mobile.css` into the repository root, replacing the existing file of the same name.
5. Do not replace `index.html`, `js/main.js`, `js/production-world.js`, `styles.css`, `.git`, `public/assets/`, GLB models or environment files with this package. They are not included.
6. In GitHub Desktop, confirm that the only source file changed by this package is `performance-mobile.css`.
7. Commit with: `CALLORIA v6.70 — mobile state and touch layout repair`.
8. Push to `main`. Wait for the existing Vercel production deployment to report Ready before testing the live site.

## What this repairs

- Hides the game launch overlay outside the explicit launch state. This addresses the duplicate hero/heading layer visible over the actual home/workplace shell after the application exits launch mode for assessment or normal application screens.
- Keeps the assessment in one readable column on phones, with full-width answer options and a full-width Continue button. The progress panel follows the question instead of squeezing it beside the question.
- Moves the Graphics control below the immersive exit control and keeps its opened panel within the phone viewport.
- Reduces joystick and action-button footprints, respects safe-area insets, and repositions station prompts/panels so they do not collide with touch controls.

## Verification required on the deployed site

1. Open CALLORIA on the phone and enter the aptitude assessment. Confirm there is only one visible application screen; no game launch headline or launch CTA should sit above it.
2. Check every answer option at normal zoom. Each option should wrap within the card and remain fully tappable.
3. Select an answer. Confirm the selection remains visible and Continue is fully visible and tappable without horizontal scrolling.
4. Enter the 3D floor. Confirm EXIT GAME and GRAPHICS do not overlap.
5. Confirm the joystick, RUN and USE controls remain inside the screen and the bottom browser safe area.
6. Rotate the phone to landscape and repeat the controls check.

## Known outstanding issue — 3D scene and GLB diagnostic

This stylesheet does **not** fix the blank 3D scene or the `GLB STAFF 0 · OFFICE OBJECTS 0` diagnostic panel visible in the supplied screenshot. The diagnostic panel's source/selector is not present in the current public `main.js`, `production-world.js` or `performance-mobile.css` reviewed for this repair. The screenshot therefore appears to include a different or additional deployed module/build. The current public GitHub `index.html` also differs from the live page copy visible in the screenshot. A CSS-only package must not pretend to fix that separate rendering/deployment mismatch.

No production deployment, physical-phone test, or WebGL visual test is claimed by this package. The release is a targeted source correction pending merge and mobile acceptance testing.
