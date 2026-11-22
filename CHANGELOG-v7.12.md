# CALLORIA v7.12 changelog

## Callback task integrity and reconciliation

Adds a read-only integrity panel to the existing Promise Control view.

### Checks

- Formal promise with no active task.
- Multiple active callback tasks on the same promise.
- Orphan active task with no matching promise.
- Active task still attached to a completed promise.
- Mismatch between callback `dueAt` and the authoritative promise `dueDate` / `dueMinutes` (one-minute tolerance).
- Active task still present while the promise is in `Needs review` hold.
- Duplicate commitment IDs and missing callback IDs.

### Compatibility and safety

- Legacy callback entries without a formal `commitmentId` are counted but not treated as errors.
- `Needs review` commitments are not incorrectly treated as missing callback tasks.
- The audit is pure/read-only and does not modify input objects.
- Customer-controlled text is escaped before rendering.
- The Vite transform has strict source-anchor checks, a duplicate-injection marker and fail-soft behaviour if the existing Promise Control source changes.
- Uses the existing client-side synthetic state only. No network calls, Supabase writes, migrations or new packages.

### Files

Adds one engine, one Vite post-transform plugin, one stylesheet and one regression test file. Requires a single import and plugin registration in `vite.config.js`.
