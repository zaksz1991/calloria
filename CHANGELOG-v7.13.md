# Changelog — CALLORIA v7.13

## Callback attempt outcomes

- Added an explicit callback-attempt outcome engine with bounded attempt history and idempotent finalisation.
- Restricted the `completed` state to verified customer-reached interactions.
- Preserved inbound callbacks as `queued` when returned to the queue before wrap-up.
- Marked outbound no-answer, busy and voicemail attempts as `attempt_failed` while existing commitment retry logic schedules the next task.
- Replaced false callback completion on outbound cancellation with `attempt_failed` plus an independent supervisor request for linked commitments.
- Aligned outbound campaign retry `callbackDueAt` with the callback record's formal `dueAt` value.
- Updated the v7.12 read-only audit to recognise `attempt_failed` as terminal attempt evidence.
- Retained v7.12's duplicate, missing, orphaned, stale and due-time drift checks.

## Compatibility

- No Supabase migration.
- No new runtime dependency.
- No change to commitment schemas or cloud-save keys.
- Legacy callback records without `commitmentId` remain excluded from formal-promise reconciliation.
