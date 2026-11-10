# Install CALLORIA v4.2.0 using GitHub Desktop

## Baseline

This patch is a cumulative replacement for the current OJT runtime used by `build/calloria-ojt-glb-activation-plugin.mjs`. It retains the v4.1 interactive shadowing code and adds the v4.2 supervised conversation. Use it on the current CALLORIA `main` branch after the existing v3.8.2 GLB/OJT plugin is present.

## Files

1. Replace `build/calloria-ojt-runtime.js` with the complete file in this ZIP.
2. Add `tests/calloria-v42-supervised-contact-practice.test.mjs` under `tests/`.

Do not replace `vite.config.js`, `package.json`, `main.js`, `index.html`, the GLB plugins or asset files. The existing v3.8.2 OJT plugin already reads this runtime by relative path.

## GitHub Desktop

1. Extract the ZIP in File Explorer.
2. Open the existing `zaksz1991/calloria` repository using GitHub Desktop.
3. Choose Repository → Show in Explorer.
4. Copy the supplied runtime into the matching `build` folder and the test into the matching `tests` folder.
5. Review the changed files. The only intended changes are those two files.
6. Commit with `CALLORIA v4.2.0 — supervised contact practice` and push to `main`.
7. Inspect the Vercel deployment result. A passing isolated test does not prove a full production build or browser session.

## Verification after deployment

Complete the previous OJT modules, then exercise all four supervised practice stages. Confirm that coaching retries persist, a complete training case is saved, and trainer sign-off remains locked until all four onboarding modules pass. Verify that production calls handled, customer cases, QA, CSAT and salary do not change during training.
