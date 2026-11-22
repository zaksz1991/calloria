# CALLORIA v7.23 — Build and test notes

## Source baseline

Audited the current public `main` source on 22 November 2026:
- `vite.config.js` imports and registers `calloriaDigitalExperienceSuitePluginV722()` at the end of its plugin list.
- `js/main.js` has one shared `renderCustomerContinuityPanel()` function used by the inbound voice, outbound voice and digital support screens.
- That panel reads `state.customerContinuity` using `getCustomerContinuityContext()` and exposes prior interactions, open cases, previous channels, QA and sentiment metadata.
- The current panel has a stable footer marker beginning `<p class="muted-note">Match basis: ...`.

The patch adds a recovery-plan section to that shared panel rather than making separate, inconsistent panels for each channel.

## Automated tests

18 focused Node tests passed. Coverage includes:
- first-contact baseline,
- escalated open-case urgency,
- multiple open-follow-up urgency,
- single open follow-up priority,
- repeat contacts inside and outside the 24-hour window,
- cross-channel continuity,
- low QA and low sentiment,
- missing metrics remain null,
- future timestamps excluded,
- duplicate case references deduplicated,
- invalid input handling,
- frozen read-only input integrity,
- repeated low-quality contact escalation threshold,
- source transformation,
- transform idempotency,
- source-drift protection,
- target-file scoping and safe warning behaviour.

The transformed JavaScript fixture passed `node --check`. JavaScript syntax checks passed for the new engine, plugin and test module. ZIP integrity was checked after packaging.

## Not claimed

A complete Vite production build, live browser session, physical mobile test and Vercel deployment were not run. The actual GitHub `main` and Vercel deployment must be checked after the patch is pushed.
