# Install v6.10 through GitHub's file interface

1. Open the CALLORIA repository on GitHub.
2. Replace the root `vite.config.js` with the ZIP's `vite.config.js`.
3. Add `build/calloria-mobile-responsive-repair-v6-10.mjs` under the existing `build` folder.
4. Add or replace `js/world-player-avatar.js` with the supplied first-person adapter.
5. Add `public/calloria-mobile-responsive-v6-10.css`.
6. Add `public/js/calloria-mobile-ui-guard-v6-10.js`.
7. Keep all other source files, all existing build plugins, the current stylesheets, and every model under `public/assets/models/`.
8. Save the changes to the `main` branch using GitHub's normal file editor/upload interface.

The `vite.config.js` in this patch is the complete v4.5-based config with the v6.10 plugin registered last. It retains the previously established plugin list. Do not use it to overwrite project-specific Vite changes added outside that known chain; merge the new import and final plugin call in that case.

After Vercel completes the deployment, test on the phone:

- Enter the 3D workplace. The player's body should not cover the view; it should remain first-person.
- Open recruitment and select an answer. The Continue/Submit action should scroll into view above the bottom dock and be tappable.
- Repeat on the practical assessment and rotate the phone once to confirm the visible-height adjustment.

The deployment and phone checks are still required; this package has not been deployed by this repair task.
