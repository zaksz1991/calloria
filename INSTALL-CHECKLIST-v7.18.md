# CALLORIA v7.18 install checklist

- [ ] Back up the existing repository folder.
- [ ] Merge `js/digital-triage-engine-v718.js`.
- [ ] Merge `build/calloria-digital-sla-triage-v718.mjs`.
- [ ] Merge `tests/digital-sla-triage-v718.test.mjs`.
- [ ] Add the Vite import once.
- [ ] Add `calloriaDigitalSlaTriagePluginV718()` once, after all existing plugins.
- [ ] Preserve existing Vite registrations and plugin ordering.
- [ ] Confirm no core engine, manifest, environment or GLB asset was replaced.
- [ ] Run the repository's normal test and build checks.
- [ ] Commit and push to `main`.
- [ ] Confirm Vercel production build success.
- [ ] In Digital Support, verify breached → at-risk → on-track ordering in both queue views.
- [ ] Verify Accept remains subject to the existing workload/capacity guard.
