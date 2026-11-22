# CALLORIA v7.23 — Customer 360 Recovery Plan

## Added

- A pure recovery assessment engine based on existing Customer 360 continuity metadata.
- A compact, expandable recovery panel embedded into the shared Customer 360 panel.
- Priority levels: Urgent Review, Priority Recovery, Continuity Watch and Standard Handling.
- Detection of outstanding escalated/review work, multiple open follow-ups, contacts within the previous 24 simulated hours, cross-channel history, and recorded low QA/sentiment values.
- Ordered next-best-action guidance aimed at preserving case continuity and avoiding duplicate cases.
- Responsive styling and reduced-motion support.

## Safeguards

- Read-only: no cases, notes, customer messages, ownership, commitments, QA scores or sentiment values are changed.
- Missing QA/sentiment values remain unavailable; they are never converted to zero.
- Future-dated interactions are excluded from recent-repeat calculations.
- Duplicate open references are counted once.
- Source transformation is idempotent and refuses partial application when required anchors drift.
- Uses the provided simulator clock rather than the workstation clock when the shift is active.

## Integration

Runs immediately after the existing v7.22 Digital Experience Suite in Vite. The shared Customer 360 panel is already rendered on inbound voice, outbound voice and digital interaction screens.
