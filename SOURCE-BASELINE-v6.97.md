# CALLORIA v6.97 source baseline

Audit basis: public `main` source for `zaksz1991/calloria` checked on 21 November 2026; relevant prior patch baseline `c8a48d6` as referenced by v6.96.

## Relevant current main.js anchors

- `renderCRM()` computes `followUpMetrics` from `caseFollowUpMetrics(state.cases, caseLifecycleClock())`.
- The v6.96 plugin adds `caseFollowUpWorkload` and `followUpWorkloadPanel` immediately after that calculation.
- The v6.96 plugin inserts `${followUpWorkloadPanel}` between the summary grid and the native `case-followup-queue` section.
- Existing case cards use the delegated `data-action="open-case-followup"` action, which the planner reuses rather than adding a new mutation path.

## Plugin chain

The v6.97 plugin uses `enforce: 'post'` and must be registered after the v6.96 plugin. It checks for the v6.96 marker before editing and fails closed if v6.96 has not run. It also requires exactly one occurrence of each insertion anchor.

## Source boundary

This package is a patch based on public source and the v6.96 transformation contract, not a full checkout of the user's private/local working tree. It does not claim to have run the complete repository's Vite build. If the branch changed the CRM anchors, the plugin will fail without applying a partial transform; the Vercel log should then be used to rebase it against the actual branch.
