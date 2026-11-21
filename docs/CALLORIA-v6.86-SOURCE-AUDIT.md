# CALLORIA v6.86 — source audit

Audit target: public `main` source for `zaksz1991/calloria`, inspected 21 November 2026.

## Files reviewed

- `vite.config.js`: old service plugin imports/registrations are still grouped after the v6.50 promotion exam. The new config replaces only that service chain with one v6.86 plugin and retains the other plugin registrations and HTML inputs.
- `js/main.js`: current applicant defaults, Workforce renderer, system launch event, CRM case rows and delegated click handler.
- `js/workforce-engine.js`: current `SYSTEMS` registry and `createSystemEvent()` validation.
- `js/cloud-employment-sync.js`: the existing cloud snapshot clones the saved state object, excluding only `viewedArticle`, and stores the payload when cloud sync is enabled. This is why v6.86 accurately discloses that its synthetic cases may be included in the cloud employment snapshot.

## Rebased anchors

The v6.86 transform validates that each target anchor occurs exactly once before changing any source:

- default applicant track, department, role title and salary;
- legacy blank-applicant migration point;
- `renderWorkforce()` and the systems-directory-to-system-activity insertion point;
- simulated `launch-system` guard;
- digital-template delegated click handler;
- CRM quality cell and case issue row;
- banking-only sandbox notice.

The Workforce transform validates exactly one `export const SYSTEMS = [` registry and its Finacle entry before replacement. Both transforms return no partial output when their required source anchors drift.

## Preserved boundaries

The plugin uses the v6.51 service catalogue as data, but removes v6.51–v6.54 plugin registration from the Vite chain. It does not add live integrations to RuffNeck products, new server APIs or a Supabase schema migration. Synthetic cases use the existing CALLORIA save path and CRM list, so they follow the app's existing local/cloud persistence configuration.
