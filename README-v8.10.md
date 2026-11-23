# CALLORIA v8.10 — Recovery Handover Report

This overlay extends the existing v8.9 recovery checklist portability controls. It adds **Export recovery handover**, which downloads a JSON report and a readable TXT summary for the active organisation workspace.

## Report contents

- Generated timestamp.
- Overall checklist state and completion percentage.
- Per-area number of marked steps, total steps and status.
- SHA-256 checksum over the canonical JSON payload.
- A plain-language limitation statement.

The report contains only allow-listed checklist progress and static recovery-area labels. It does not include the organisation scope key, account credentials, database error text, employee records, customer data or workforce history.

## Important limitation

The report records local checklist ticks. A completed checklist is not confirmation that a cloud repair succeeded. The operator must rerun the read-only cloud health diagnostics and inspect the resulting checks. The SHA-256 checksum detects accidental alteration; it is not a server signature, trusted timestamp or proof of authorship.

## Integration

The existing `calloriaWorkforceCloudRecoveryPortabilityPluginV809()` registration remains in place. The plugin file is replaced in-place and imports the new v8.10 engine from `js/`. No additional Vite plugin registration is required.

The release carries forward the v8.9.2 `package.json` contract repair, including the exact v8.6 read-only cloud-health command and exact protected `prebuild` / `check` hooks.

No Supabase migration, Edge Function, secret, environment variable or dependency is added.
