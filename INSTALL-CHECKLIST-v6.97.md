# v6.97 deployment checklist

- [ ] Confirm the repository already has the v6.96 CRM follow-up workload plugin.
- [ ] Merge package `build/`, `js/` and `tests/` folders into the repository root.
- [ ] Add the v6.97 import to `vite.config.js`.
- [ ] Register v6.97 immediately after v6.96; register each once.
- [ ] Preserve the v6.94/v6.95 case-lifecycle safety plugins if installed.
- [ ] Review changed files in GitHub Desktop.
- [ ] Commit and push to `main`.
- [ ] Confirm Vercel completes `vite build`.
- [ ] Open CRM and check the planner appears beneath follow-up ownership/workload.
- [ ] Verify supervisor-review, overdue, due-soon, paused-off-shift and unassigned test records.
