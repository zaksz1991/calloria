# v7.11 source baseline

Audited current public `main` on 22 November 2026.

Relevant live source regions in `js/main.js`:
- `renderWrapUp()` renders the existing inbound/outbound after-contact form and checklist.
- `saveWrapUp()` validates the disposition before creating records and changing queue / campaign state.
- Inbound case persistence uses `state.cases.push(record);recordCustomerContinuityFromCase(record,...)`.
- Outbound attempt persistence uses `state.outboundAttempts.push(attemptRecord);`.
- Outbound case persistence uses `state.cases.push(outboundCase);`.

The v7.11 plugin uses these exact structural anchors and requires exactly one of each. It runs as a post-transform to see source after preceding Vite plugins. If the checked-out branch differs, it fails closed and does not apply a partial transform.
