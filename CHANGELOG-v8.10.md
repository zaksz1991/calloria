# CALLORIA v8.10 — Recovery Handover Report

- Adds a local export of the current cloud-recovery checklist status in JSON and human-readable TXT formats.
- Reports per-area checklist counts and overall completion percentage.
- Uses a SHA-256 checksum to detect accidental report modification.
- Excludes raw organisation identifiers, account details, database errors, employee records and customer records.
- Explicitly labels completion as self-reported checklist progress, not proof that a repair succeeded.
- Preserves v8.9 checklist backup/import and the v8.9.2 Vercel package contract.
