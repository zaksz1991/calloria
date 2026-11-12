# v6.9 Changelog

## Customer Commitments & Callback Management

- Added optional callback commitment scheduling to customer-contact wrap-up.
- Added simulated 30-minute and 60-minute promise options plus next-working-day and two-working-day options.
- Added automatic roll-forward when a same-shift callback would fall after the 16:00 shift close.
- Added per-employee callback commitment list with scheduled, due-soon, due, overdue and review states.
- Added completed, no-answer and further-action callback outcomes.
- Added automatic next-working-day rescheduling after an unsuccessful or incomplete callback.
- Added a two-attempt limit before a commitment requires documented manager review.
- Added separate reviewer identity and written review outcome; reviewer identity is not authenticated.
- Added outbound attempt and outcome notes to Customer 360 and open case interaction timelines.
- Added callback reference/due time to completed contact records and outstanding commitment counts to the shift report.
- Preserved previous voice, digital, social, SMS, in-app, skill-routing, customer dynamics, career and office routines.
- Did not add accounting, banking, external messaging, telephony, AI endpoints, API keys, database migrations or Vite configuration changes.

## Known boundaries

- Synthetic customer commitments only; no real outbound call is made.
- Due time advances on the simulated game clock, not a real-time background timer.
- Browser-local persistence only; no cross-device or shared team queue.
- Manager review names are simulation inputs, not authenticated approvals.
- Full Vite build, Vercel deployment and browser end-to-end verification were not performed.
