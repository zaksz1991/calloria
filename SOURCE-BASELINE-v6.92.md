# CALLORIA v6.92 — Source baseline

Inspected on 21 November 2026 against the public `main` branch and the v6.91 overlay currently in the working package.

## Existing source contracts used

- `index.html` already loads `agent-handover-engine.js` indirectly through `js/main.js`; the v6.92 module imports that existing engine from the same `js/` directory. The new module and stylesheet are registered in `index.html` before `js/main.js`.
- `js/main.js` has an `Agent shift handover` view and constructs its work resources from the saved CRM cases, commitment state, digital queue and callbacks. It identifies the employee with `EMP-${state.nameInitials}`.
- The existing view already disables handover preparation while an inbound call, outbound interaction or after-contact work is active.
- `agent-handover-engine.js` is the system of record for eligibility, pending-item exclusions and two-party transfer. It includes owned active digital contacts, open customer commitments, eligible case follow-ups and owned open CRM cases; it deliberately leaves active voice/outbound sessions outside the transferable set.
- The engine only transfers work when the named incoming agent accepts. The existing UI identifies typed-name acknowledgement as local simulation only, not identity-provider authentication.

## Version and deployment caution

The package builds on the v6.91 working overlay's `index.html` and the public `main` source. The earlier Vercel log supplied in this conversation referenced commit `c8a48d6`. This package does not assert that this commit is the same as the current public `main`; compare the deployed commit before merging the replacement `index.html`.

## Scope

The package does not include the full application, existing `agent-handover-engine.js`, 3D assets, Supabase functions, migrations, secrets or Vercel configuration. Preserve those repository files.
