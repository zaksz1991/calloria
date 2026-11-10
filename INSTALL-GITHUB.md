# Install CALLORIA v4.3.0 using GitHub Desktop

## Files

1. Replace `build/calloria-ojt-runtime.js` with the complete file in this ZIP.
2. Add `tests/calloria-v43-trainer-signoff-allocation.test.mjs` under `tests/`.
3. Keep `tests/calloria-v42-supervised-contact-practice.test.mjs` from the ZIP. If the repository already has that exact v4.2 test, the supplied copy is unchanged and can be compared before replacing.

This runtime is cumulative: it already includes the interactive shadowing and supervised-contact practice from v4.1/v4.2. Install the v4.3 runtime as the single OJT runtime; do not stack the earlier runtime files.

## Do not replace

Do not replace `vite.config.js`, `package.json`, `main.js`, `index.html`, any GLB/Vite build plugin, GLB registry, model binary or Supabase file. The existing OJT/GLB plugin should continue to read `build/calloria-ojt-runtime.js` by its existing path.

## GitHub Desktop

1. Extract the ZIP in File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the supplied `build/calloria-ojt-runtime.js` into the repository's `build` folder, replacing that complete file.
5. Copy the v4.3 test into the repository's `tests` folder. Keep the v4.2 test too.
6. Review the changed-file list. The intended changes are the OJT runtime and the two OJT regression-test files only.
7. Commit with `CALLORIA v4.3.0 — trainer sign-off and workstation allocation` and push to `main`.
8. Inspect the Vercel production build. Do not assume deployment success from the isolated tests.

## Browser acceptance sequence

1. Create a new employee profile and accept the employment offer.
2. Complete product/service knowledge, CRM logging, experienced-agent shadowing and supervised contact practice.
3. Request trainer review. Confirm the employee is not yet certified and cannot start a shift.
4. Complete all four simulated trainer attestations and approve the review.
5. Select an operating department and a workstation. Confirm the assigned desk, department and universal customer-care rotation are saved.
6. Navigate to Workforce during the applicable briefing attendance window and record the 07:30 morning or 14:00 afternoon briefing.
7. Start the first shift at the permitted time. Confirm the existing shift engine becomes active and the first-working-shift record contains the allocated workstation.
8. Confirm the shift opens the existing simulated operations queues; no training contact is counted as production work.
9. Recheck that an existing employee with previous production work is not forced back through onboarding.

## Verification boundary

The trainer is simulated, the desk allocation is part of the saved game state, and the existing shift engine powers the simulated first shift. This package does not verify live telephony, a real human trainer, a real physical desk or visible GLB desk placement. Run the full repository tests and Vite production build after merging.
