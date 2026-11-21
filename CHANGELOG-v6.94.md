# CALLORIA v6.94 — Case outcome integrity guard

## Operational repair

The current case lifecycle engine validates customer confirmation for a resolved agent follow-up and for an independent supervisor closure, but those checks occur after some mutable follow-up fields have already been written.

If the customer-confirmation checkbox is not selected, the operation throws an error but may leave in-memory changes to attempt counts, last outcome/summary or supervisor review metadata. Those partial changes could later be included in a save triggered by another action.

v6.94 moves both confirmation checks into the validation phase, before any outcome or review fields are changed. The original close-branch checks are removed only after the matching preflight guard has been installed. The transform fails closed if it cannot find exactly one of every expected anchor.

## Preserved behaviour

- An agent can still resolve a reopened case after recording factual evidence and explicit customer confirmation.
- A supervisor can still close after independent review, evidence and customer confirmation.
- Same-owner supervisor reviews remain rejected.
- `pending_customer` outcomes remain open and rescheduled.
- `escalated` outcomes still route the follow-up to supervisor review.
- Existing attempt counts, due times, ownership, audit history, customer records and save format remain unchanged on successful operations.

## Scope

Build-time source transform only. No changes to `index.html`, `main.js`, case data schema, Supabase, cloud sync, APIs, environment variables, GLB assets or dependencies. No customer data is sent outside the game.
