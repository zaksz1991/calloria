# v7.10 installation checklist

- [ ] Back up the current CALLORIA repository.
- [ ] Add `js/live-call-coach-v710.js`.
- [ ] Add `build/calloria-live-call-coach-v710-plugin.mjs`.
- [ ] Add `calloria-live-call-coach-v710.css` at the repository root.
- [ ] Add `tests/live-call-coach-v710.test.mjs`.
- [ ] Add the Vite import.
- [ ] Register the plugin exactly once at the end of the plugin array.
- [ ] Preserve all existing plugin registrations and application assets.
- [ ] Commit and push to `main`.
- [ ] Confirm Vercel runs `npm run build` and reports a successful deployment.
- [ ] Open an inbound voice call and confirm the Live Call Playbook appears in the side stack.
- [ ] Test payment, technical, complaint and security scenarios.
- [ ] Click **Add to response** and confirm it only fills the composer; it must not send automatically.
- [ ] Test a pending customer decision and supervisor-risk state; the playbook should switch priority.
