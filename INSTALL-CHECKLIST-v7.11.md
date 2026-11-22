# CALLORIA v7.11 installation checklist

- [ ] Back up the current repository.
- [ ] Merge `js/calloria-wrap-evidence-v711.js`.
- [ ] Merge `build/calloria-after-contact-evidence-gate-v711.mjs`.
- [ ] Merge `tests/after-contact-evidence-v711.test.mjs`.
- [ ] Add the Vite import once.
- [ ] Add the Vite plugin registration once, at the end of the plugin array.
- [ ] Preserve all existing Vite plugins, project settings and assets.
- [ ] Commit and push the changes.
- [ ] Confirm the Vercel build passes.
- [ ] In a guest test profile, complete an inbound case and verify the evidence fields appear on the saved case.
- [ ] Test an inbound callback and an escalation.
- [ ] Test an outbound no-answer and opt-out attempt.
- [ ] Confirm mismatched evidence is rejected without saving or advancing the interaction.
