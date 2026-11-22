# CALLORIA v7.23 source baseline

Reviewed current public source on 22 November 2026:

- `vite.config.js`: v7.22 Digital Experience Suite is registered as the last existing plugin. v7.23 is designed to run immediately after it.
- `js/main.js`: the Customer 360 function is shared across inbound, outbound and digital customer workflows. It uses `getCustomerContinuityContext()` and renders recent history and open follow-ups.
- `js/customer-continuity-engine.js`: returns repeat-customer status, recent interaction metadata, previous channels, open cases, last interaction, match basis, QA and sentiment values.

The new recovery plan consumes this existing context. It does not create a parallel customer registry or alter the save format.

This package is a targeted overlay. It does not include the whole public repository or its GLB assets.
