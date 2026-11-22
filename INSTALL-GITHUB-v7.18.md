# Install CALLORIA v7.18 — GUI workflow

This is an additive overlay. It is not a full repository replacement.

## Files to merge

Copy these folders/files into the existing CALLORIA repository, preserving the same paths:

- `js/digital-triage-engine-v718.js`
- `build/calloria-digital-sla-triage-v718.mjs`
- `tests/digital-sla-triage-v718.test.mjs`

Do not copy any mock versions of `multichannel-engine.js` or `digital-sla-engine.js`; the package intentionally does not include replacements for those existing core modules.

## Vite registration

Open the existing `vite.config.js` in your normal text editor. Add the import and one plugin call exactly as shown in `VITE-CONFIG-ADDITIONS-v7.18.txt`.

Keep the existing plugin array intact. Add v7.18 after all plugin registrations already present in your branch, including any previously installed v7.15–v7.17 overlays. Do not register it twice.

## GitHub Desktop

1. Back up the current repository folder.
2. Extract the ZIP.
3. Copy the included `js`, `build` and `tests` folders into the repository root and allow the new files to merge.
4. Add the Vite import and plugin registration described above.
5. Review the changed-file list in GitHub Desktop. Confirm that no existing core modules, `vite.config.js` outside the intended two-line addition, `package.json`, `vercel.json`, `.env` files, Supabase configuration or `public/assets/` files were overwritten.
6. Commit with: `CALLORIA v7.18 — digital SLA triage and ageing fairness`.
7. Push to `main` and inspect the Vercel deployment log.

## Expected behaviour

In the Digital Support view, both the active-thread quick queue and the full waiting queue should now show SLA-breached items first, then at-risk items, then on-track items. Each row receives a short triage explanation badge. Existing Accept buttons and workload checks continue to control whether an item can be accepted.

## Safety

The plugin only changes queue presentation order and adds an explanation badge. It does not auto-accept, claim, reassign, close, reschedule, or modify contacts. It does not change SLA targets, saved progress, Supabase or real customer inboxes.
