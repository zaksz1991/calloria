# CALLORIA v8.11 — Recovery Handover Verification

## Added

- Added local, offline verification for v8.10 recovery handover JSON reports.
- Validates the report format/version, strict payload shape, area IDs and labels, timestamps, step bounds, per-area statuses, aggregate totals and completion percentage.
- Recomputes SHA-256 over the canonical payload and rejects modified or malformed files.
- Adds a **Verify handover report** control beside the existing recovery checklist export/import actions.
- Caps selected report size at 256 KiB.

## Safety boundaries

- Verification runs in the browser. The selected file is not uploaded or persisted.
- Verification does not import or change checklist progress, cloud snapshots, conflict records or workforce history.
- A matching checksum detects accidental or deliberate payload changes relative to the supplied checksum. It does not establish who created the report.
- A completed checklist remains progress evidence only and does not prove that a repair worked.

## Preserved

- v8.10 handover export and v8.9 checklist portability remain available.
- v8.9.2 exact Vercel `prebuild` and `check` hooks remain unchanged.
- v8.6 cloud-health regression command remains present.
- Node 22 and all existing dependency pins remain unchanged.
- No Supabase migration, Edge Function, secret, environment variable or dependency is added.
