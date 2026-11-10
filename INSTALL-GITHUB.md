# CALLORIA v4.1.0 — GitHub Desktop installation

## Files

| ZIP file | Repository destination | Action |
|---|---|---|
| `build/calloria-ojt-runtime.js` | same path | Complete replacement |
| `tests/calloria-v41-interactive-ojt-shadowing.test.mjs` | same path | Add |

## Install without a terminal

1. Extract the ZIP in Windows File Explorer.
2. Open `zaksz1991/calloria` in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Copy the included `build/calloria-ojt-runtime.js` over the existing file at that exact path.
5. Copy the new test file into the existing `tests` folder.
6. In GitHub Desktop, confirm the changed-file list contains only those two files.
7. Commit as `CALLORIA v4.1.0 — interactive OJT shadowing` and push to `main`.
8. Inspect the Vercel production build before testing the flow in the deployed game.

## Acceptance test

Use a fresh guest employment profile or a hired profile that has not completed onboarding. Complete knowledge and CRM logging first. In shadowing, confirm the queue offer must be accepted, the greeting must be observed, CRM fields must be completed, the approved knowledge article must be marked reviewed, and the final disposition must match the selected route. Trainer sign-off must remain unavailable until supervised practice also passes.

Existing profiles with `onboarding.progress.shadowing === true` remain complete; the upgrade does not reset already completed OJT modules.
