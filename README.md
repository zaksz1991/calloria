# CALLORIA v7.12 — Callback Task Integrity

A focused, additive overlay for the Promise Control workspace. It adds a read-only reconciliation report for formal callback commitments and the callback tasks linked to them.

## What it detects

- Open commitments with no active callback task.
- More than one active task linked to a single commitment.
- Active tasks whose commitment ID no longer exists.
- Active tasks left attached to completed commitments.
- Callback task due timestamps that differ from the formal promise due date/time.
- Active callback tasks left on promises held for independent supervisor review.
- Duplicate formal commitment IDs and malformed record IDs.

Legacy callback records without a `commitmentId` are counted separately. They are not labelled as broken because they pre-date the formal commitment ledger.

## Safety boundary

The panel does not create, remove, reschedule, reassign, start or close tasks. It does not mutate promise state. It reports the findings and recommends manual review in the existing Promise Control workflow. A `Needs review` promise is intentionally not classified as a missing-task error because supervisor review is a hold state, not permission to make another call.

## Included files

- `js/callback-integrity-engine-v712.js`
- `build/calloria-callback-integrity-v712-plugin.mjs`
- `styles/calloria-callback-integrity-v712.css`
- `tests/callback-integrity-v712.test.mjs`
- GUI installation and verification documents

This archive is a source overlay, not a complete CALLORIA repository.
