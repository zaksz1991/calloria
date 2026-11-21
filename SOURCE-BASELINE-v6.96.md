# CALLORIA v6.96 source baseline

Audit date: 21 November 2026.

Baseline checked: repository commit `c8a48d6` on `main`.

## Verified main.js anchors

The public `js/main.js` at commit `c8a48d6` contains the following anchors:

1. Case lifecycle import from `./case-lifecycle-engine.js` including `caseFollowUpMetrics` and `formatCaseClock`.
2. `const followUpMetrics=caseFollowUpMetrics(state.cases,caseLifecycleClock());` inside `renderCRM()`.
3. The CRM markup beginning with the `case-followup-metrics` summary grid and immediately followed by `<section class="panel case-followup-queue" style="margin-top:14px">`.

The plugin checks each anchor for exactly one occurrence and builds the transformed source in memory. If a required anchor is missing or duplicated, the Vite transform fails without returning a partial source transform.

## Verified Vite registration baseline

The same commit's `vite.config.js` registers `calloriaRuffNeckServiceOperationsPluginV686()` in the application plugin list, followed by the visitor-facing public experience plugins. The v6.96 plugin is added as an independent `enforce: 'post'` transform and is scoped only to `js/main.js`.

## Source boundary

This was checked against the public commit `c8a48d6`, which matches the commit shown in the supplied Vercel build log. It is not a full local repository checkout. It does not establish that later local edits or another branch retain every anchor. The plugin therefore fails closed on source drift.
