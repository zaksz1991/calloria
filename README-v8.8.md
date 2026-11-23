# CALLORIA v8.8 — Recovery Progress Checklist

v8.8 extends the existing Workforce History cloud-recovery runbook with locally saved, organisation-scoped checklist progress.

## Behaviour
- Each failed or warning diagnostic check shows its existing recovery instructions as tickable checklist items.
- The card reports how many steps have been marked complete.
- Checklist progress is stored in this browser only, under a namespaced key derived from the active organisation identifier. The raw identifier is not written to the checklist key or checklist value.
- Only fixed remediation IDs and numeric step indexes are stored. No diagnostic error, account, employee or customer content is captured.
- Completing all boxes does not mark a cloud check healthy. Run **Run read-only health check** again. A passing check removes its recovery card and prunes its progress from the current runbook.
- **Reset checklist** clears the progress for that one recovery card.
- If local storage is blocked, the checklist remains usable in memory for the current session and the status message explains that progress may not survive reload.

The namespace hash is used only to separate browser checklist records by organisation. It is not an authentication or encryption mechanism. Existing Supabase authorisation and RLS remain the security boundary.

## Files
See `UPDATED-FILES.txt` for the exact replace/add manifest. Merge the contents of this folder into the existing CALLORIA repository root. Do not remove existing assets, `.git`, environment files or unrelated repository content.

No database migration, secret, Vercel environment variable or dependency installation change is required.
