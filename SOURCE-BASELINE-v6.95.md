# CALLORIA v6.95 source baseline

Audit date: 21 November 2026.

Repository source inspected: `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/case-lifecycle-engine.js`.

## Confirmed source path

`completeCaseFollowUp()` handles the `pending_customer` outcome by calculating:

- a due day from `absoluteMinute(clock) + 1440`;
- then assigning `followUp.dueMinute = 600` (10:00) regardless of the calculated minute.

This combines a 24-hour offset with a separately fixed 10:00 clock. For example, resolving at simulated Day 3, 23:00 calculates Day 4, 23:00, then stores Day 4, 10:00. The displayed and stored deadline is therefore not the deadline implied by the first calculation.

The existing return value and history event use the stored day/minute, so v6.95 corrects the source calculation rather than changing UI formatting.

## Transform strategy

- Applies the v6.94 closure-integrity transform first.
- Rewrites exactly one `pending_customer` block in `js/case-lifecycle-engine.js`.
- Uses an independent v6.95 marker for idempotency.
- If the source anchor is absent or duplicated, the Vite build fails closed before transformed source is returned.
- Does not replace the application source file.

## Explicit scope limitation

The source baseline is public GitHub `main`, not a byte-for-byte checkout of the production commit used in an earlier Vercel log. The user's exact branch must confirm the build after the overlay is committed.
