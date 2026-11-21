# CALLORIA v6.93 source baseline

Baseline inspected: public `github.com/zaksz1991/calloria` branch `main` on 2026-11-21.

Relevant source references inspected:

- `js/customer-continuity-engine.js`: v6.68.0 continuity engine. Its current `repeatCustomer` flag is `profile.totalInteractions >= 1`, which classifies any profile with one prior interaction as a repeat customer. Its open-follow-up calculation treats every non-closed status as open, including generic `Recorded` history. Its numeric conversion also turns `null` into zero for QA/sentiment during normalisation.
- `js/main.js`: imports the continuity engine and contains `renderCustomerContinuityPanel(customer, channel, identity = {})`, followed by `ensureInboundQueue(count = 6)`. The Customer 360 template has a stable location immediately after its four-row data-list.
- `vite.config.js`: currently imports/registers `calloriaCareerDevelopmentPluginV688()` before the visitor-experience plugins. The new plugin is registered immediately after it so it sees the current post-career transform.
- `package.json`: package version is `0.3.0`, with ESM enabled and test command `node --test tests/*.test.mjs tests/commitment-engine-v69.test.cjs`.

The v6.93 transform is deliberately strict and idempotent. It requires one instance of the Customer 360 panel and its following function boundary. Changed source fails closed; it does not return partially modified code.

The public `index.html` has a visible `BUILD 1.4.0` label. This is a UI build label, not the npm package version; the inspected public files contain both values.
