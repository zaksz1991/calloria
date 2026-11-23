# CALLORIA v8.11 — Recovery Handover Verification

CALLORIA v8.11 adds a local integrity check for the JSON recovery handover reports exported by v8.10.

## Runtime behaviour

In the Workforce Cloud Recovery panel, select **Verify handover report** and choose a v8.10 JSON handover. CALLORIA checks the payload schema and version, the generated timestamp, recovery-area identifiers and labels, item-level step counts and statuses, summary totals, completion percentage, limitation notice and SHA-256 checksum.

A successful verification reports the checklist progress recorded in the file. It does not import the report, write to local storage, contact Supabase, or modify cloud records. A checksum is not a digital signature and cannot prove who created a file. A checksum match also cannot prove any repair succeeded.

## File limits

The browser rejects files larger than 256 KiB. The verifier accepts v8.10 JSON reports only; the paired human-readable TXT report is for reading and is not a verification input.

## Build contract

The package adds the focused `verify:workforce-cloud-handover-verification` script. It does not modify the exact Vercel `prebuild` or `check` commands, the v8.6 health check, the v8.10 handover test command, Node 22, or dependency versions.
