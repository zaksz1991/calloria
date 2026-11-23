# CALLORIA v8.12 — Recovery Handover Comparison

v8.12 adds a local comparison tool to the Workforce Cloud Recovery panel.

## Use
1. Export two recovery handover reports at different points in the recovery process. Reports must use the existing v8.10 handover format.
2. Confirm that both reports came from the same organisation. The report format contains no organisation identifier, so CALLORIA cannot verify that relationship automatically.
3. Select **Compare two handover reports** and choose exactly two JSON reports.
4. CALLORIA verifies both checksums, sorts the reports by export time and displays the progress change for each recovery area.
5. Review regressions and mixed movement separately from the aggregate step and percentage changes.
6. Rerun the read-only cloud health check to establish the actual system state.

## Safety boundary

Comparison is offline and read-only. It does not import checklist ticks, save comparison results, upload files, alter local recovery progress, write Supabase rows or call an Edge Function. The output describes checklist progress only. It cannot authenticate the report author or prove a repair succeeded. Because SHA-256 is an unkeyed digest, a party able to edit a report can also recalculate its checksum; it is an integrity check, not a digital signature.

## Included changes

- Replaces `build/calloria-workforce-cloud-recovery-portability-v809.mjs` with the existing export/import/verification integration plus the v8.12 comparison UI.
- Replaces `styles/calloria-workforce-cloud-recovery-portability-v809.css` with responsive comparison result styles.
- Adds `js/workforce-trend-cloud-recovery-handover-comparison-engine-v812.js`.
- Adds focused unit and integration tests.
- Updates `package.json` only by adding `verify:workforce-cloud-handover-comparison`.
