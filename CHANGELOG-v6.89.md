# CALLORIA v6.89 — Shift close-out performance review

## New behaviour

- Shows an end-of-shift report when the saved employee state transitions from an active shift to a closed shift.
- Captures a baseline at shift start and calculates period deltas instead of displaying lifetime totals as if they belonged to one shift.
- Reports inbound and outbound volume, resolutions, sales, new CRM cases, customer commitments, average QA, average CSAT and shift adherence.
- Handles guest/local saves and organization-scoped `calloria.save.*` keys.
- Retains a session baseline across page reloads. When a baseline cannot be recovered, clearly marks the report as partial.
- Uses a responsive dialog with keyboard dismissal, visible focus styles, safe-area spacing and reduced-motion support.

## Scope boundaries

- No changes to the main application state schema.
- No changes to hiring, shift rules, payroll, promotions, campaign rules or QA scoring.
- No remote write, tracking request, analytics endpoint or external integration.
- The report is a local simulation summary, not a real HR or payroll document.

## Files

- `index.html` — loads the new stylesheet and runtime before the existing application module.
- `js/calloria-shift-review-v6-89.mjs` — pure summary functions and browser runtime observer.
- `calloria-shift-review-v6-89.css` — responsive report presentation.
- `tests/calloria-shift-review-v6-89.test.mjs` — regression tests.
