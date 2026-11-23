# CALLORIA v8.12 — Recovery Handover Comparison

## Added
- Compare two previously exported v8.10 recovery handover JSON reports locally.
- Verify both reports with the v8.11 SHA-256 verifier before producing a comparison.
- Order reports by export timestamp and show completed-step and completion-percentage movement.
- Show every recovery area independently, including regressions that might otherwise be hidden by a positive overall change.
- Flag mixed movement when some areas improve while others regress.
- Handle same-timestamp reports explicitly using the selected file order.
- Keep all comparison data in memory only; no import, local persistence, Supabase write or network call is made.

## Preserved
- v8.9.2 exact Vercel `prebuild` and `check` scripts.
- v8.6, v8.9, v8.10 and v8.11 verification commands.
- Existing Node 22 and pinned dependency versions.
- Existing Vite plugin registration, Supabase settings, migrations, credentials and 3D assets.

## Limitations
- Reports do not contain an organisation identifier, so the comparison cannot prove that both files belong to the same organisation. The operator must confirm this.
- SHA-256 verifies that each file matches its included checksum; it does not authenticate the author or prevent an informed party from recalculating a checksum after editing.
- Checklist movement is not evidence that a cloud repair succeeded. Run the live read-only cloud health check separately.
