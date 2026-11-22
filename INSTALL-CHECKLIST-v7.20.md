# CALLORIA v7.20 installation checklist

- [ ] Back up the current repository or create a branch in GitHub Desktop.
- [ ] Merge the supplied `build/`, `js/`, `styles/` and `tests/` folders.
- [ ] Remove individual v7.15–v7.19 digital plugin imports and registrations, if previously added.
- [ ] Add the one v7.20 suite import to `vite.config.js`.
- [ ] Register `calloriaDigitalWorkflowSuitePluginV720()` once after the current final plugin.
- [ ] Preserve unrelated Vite plugin registrations and order.
- [ ] Commit and push `CALLORIA v7.20 — consolidate digital workflow suite`.
- [ ] Confirm the Vercel production build succeeds.
- [ ] Test unsafe digital reply blocking.
- [ ] Test separate awaiting-customer and pending-customer metrics.
- [ ] Test specialist handoff and supervisor request linkage.
- [ ] Test valid and invalid digital disposition evidence.
- [ ] Confirm SLA-first ordering and queue ageing badges.
