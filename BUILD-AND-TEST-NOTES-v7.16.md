# Build and test notes — v7.16

The included regression suite is designed to run through the repository's existing `node --test tests/*.test.mjs` script.

Manual test scenario after deployment:
1. Start a shift and open Digital Support.
2. Accept a queued email/chat/social contact and submit a response. The contact transitions to `awaiting_customer`.
3. Confirm the `Active threads awaiting customer` value increases.
4. Finish another digital contact using the `pending_customer` disposition.
5. Confirm the `CRM cases pending customer` value increases independently.
6. Confirm one status does not inflate the other.

The patch does not change actual case lifecycle, save persistence or first-response SLA timing.
