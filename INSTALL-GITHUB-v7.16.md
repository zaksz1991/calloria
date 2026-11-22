# Install CALLORIA v7.16 — GUI steps

This is an additive overlay, not a complete repository replacement.

1. Back up the current CALLORIA repository before changing files.
2. Extract the ZIP.
3. In GitHub Desktop select the CALLORIA repository, then Repository → Show in Explorer.
4. Copy the ZIP's `js`, `build` and `tests` folders into the repository root and merge folders when Windows asks.
5. Open `VITE-CONFIG-ADDITIONS-v7.16.txt` and apply the single import and plugin registration to the existing `vite.config.js`.
6. Keep every existing Vite plugin and its current order. Register v7.16 once, after the existing final plugin and after v7.15 if v7.15 is already installed.
7. In GitHub Desktop review the changed-file list. Confirm the package did not replace `vite.config.js`, `main.js`, `multichannel-engine.js`, `package.json`, `vercel.json`, Supabase settings or `public/assets`.
8. Commit with: `CALLORIA v7.16 — digital customer-state integrity`.
9. Push to `main` and check the Vercel deployment log.

## Expected behaviour

The digital service performance section now reports the two separate states:
- **Active threads awaiting customer** — assigned digital conversations in `awaiting_customer` state.
- **CRM cases pending customer** — completed digital interactions recorded with a `pending_customer` disposition.

The change only corrects queue metrics and labels. It does not re-open cases, change ownership, deliver messages or adjust SLA timers.

## Rollback

Remove the v7.16 import and plugin registration from `vite.config.js`, then remove:
- `build/calloria-digital-state-integrity-v716.mjs`
- `js/digital-customer-state-metrics-v716.js`
- `tests/digital-state-integrity-v716.test.mjs`

Restore the backed-up `vite.config.js` if needed.
