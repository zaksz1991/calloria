# CALLORIA v6.95 — GUI installation

## Package scope

This is a targeted cumulative Vite-plugin overlay, not a complete repository replacement. It includes the v6.94 transactional closure guard so v6.95 does not depend on the earlier plugin having already been installed.

## Files to merge

Copy these files into the matching locations in the existing CALLORIA repository:

- `build/calloria-case-resolution-transaction-guard-v6-94.mjs` — required dependency, included for a self-contained overlay.
- `build/calloria-case-sla-clock-accuracy-v6-95.mjs` — new plugin.
- `VITE-CONFIG-ADDITIONS-v6.95.txt` — exact Vite registration lines.

The `tests/` folder is verification material. It does not need to be deployed.

## GitHub Desktop / File Explorer

1. Make a backup of the current repository folder.
2. Extract this ZIP.
3. Open GitHub Desktop and select the existing `calloria` repository.
4. Choose **Repository → Show in Explorer**.
5. Copy the supplied `build` folder into the repository root and merge folders. Do not delete existing build plugins.
6. Open `vite.config.js` using the text editor already associated with `.js` files.
7. Add the import and plugin registration shown in `VITE-CONFIG-ADDITIONS-v6.95.txt`.
8. Register `calloriaCaseSlaClockAccuracyPluginV695()` exactly once. Place it after the other case-lifecycle/career transforms and before the visitor-facing transforms.
9. If the v6.94 plugin is already registered, leave it in place. v6.95 includes the same guard and recognizes its marker, so the guard will not be applied twice.
10. Save `vite.config.js`, return to GitHub Desktop, review the changed-file list, commit, and push to `main`.

## What changes at runtime

When an agent records `pending_customer` on a reopened case, the next follow-up deadline is now consistently set to **10:00 on the next simulated day**. Previously, the engine added 1,440 minutes to determine the day and then independently forced the minute to 600 (10:00). Late-day cases could therefore be given a day/time pair that did not correspond to the calculated 24-hour interval.

The same due day and minute are written to the follow-up record, returned to the caller, and included in the follow-up history event.

The v6.94 customer-confirmation preflight remains included: rejected agent or supervisor closures do not partially update attempt or review metadata.

## Preserved

- `js/case-lifecycle-engine.js` is not replaced.
- No `index.html`, `main.js`, `public/` or 3D asset replacement.
- No Supabase migration, database schema change, new package dependency or environment-variable change.
- Existing urgent/normal reopen SLAs and supervisor review flow remain unchanged.

## Deployment verification

After pushing, confirm the Vercel deployment completes. The package's focused Node regression suite passed locally, but a full Vite production build and live Vercel deployment have not been run from your exact repository checkout. If Vercel reports an anchor mismatch, do not remove the guard: capture the new log and source baseline first.
