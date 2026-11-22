# CALLORIA v7.20 — Digital Workflow Suite Integration

A cumulative integration overlay for the current public CALLORIA `main` source. This release consolidates the v7.15–v7.18 digital support transforms and repairs the v7.19 disposition-evidence transform so they run as one ordered Vite plugin.

## Why this release exists

The public `vite.config.js` inspected on 22 November 2026 ends its plugin array with `calloriaTryItStudioPlugin()` and does not register the v7.15–v7.19 digital plugins. Earlier releases supplied separate import/registration instructions, leaving the feature chain dependent on manual ordering.

There was also a real source-anchor conflict: v7.17 inserts a specialist handoff draft between the disposition read and the `try` block, and adds specialist fields between the disposition selector and case-notes field. The original v7.19 transform expected both of those locations to remain contiguous, so v7.19 would skip after v7.17. Its escalation check also examined the saved supervisor-request list before v7.17 persisted the new specialist handoff draft, which could reject a valid newly-created referral.

## What v7.20 does

- Adds one Vite plugin entry: `calloriaDigitalWorkflowSuitePluginV720()`.
- Internally runs the transforms in deterministic order: v7.15 coach → v7.16 customer-state metrics → v7.17 specialist handoff → v7.18 SLA triage → v7.20 disposition evidence.
- Replaces the brittle v7.19 completion-block match with an exact anchor immediately before `completeDigitalContact()`.
- Places the outcome-evidence field immediately before the case-notes field, so it remains compatible with v7.17's inserted specialist section.
- Treats a validated, in-scope `specialistHandoffDraft` created by v7.17 as referral evidence during the same completion transaction. The draft is still persisted by the existing v7.17 flow after the case completion succeeds.
- Retains idempotency markers. Running the suite more than once does not duplicate imports, markup or workflow code.

## Included functionality

- v7.15: digital reply quality coaching and hard safety blockers for credential requests, unmasked card numbers and public social requests for identifiers.
- v7.16: separate active threads awaiting a customer from CRM cases pending customer information.
- v7.17: specialist destination selection and supervisor-routed handoff with CRM linkage.
- v7.18: SLA-first digital queue triage with bounded ageing fairness.
- v7.20: outcome evidence requirements for resolved, pending-customer and escalated digital dispositions, saved onto the synthetic CRM case.

All digital interactions remain local synthetic simulation. This release does not connect real inboxes, social accounts or customer systems.

## Package layout

- `build/` — ordered Vite transforms and the single suite entry.
- `js/` — digital coaching, state metrics, specialist handoff, triage and disposition validation modules.
- `styles/` — coach and specialist handoff stylesheets.
- `tests/` — previous focused regression suites plus full-chain integration tests.
- `docs/` — baseline and technical notes.

## Install

Follow `INSTALL-GITHUB-v7.20.md`. Register only the suite plugin; do not separately register v7.15, v7.16, v7.17, v7.18 or v7.19.

This is an additive overlay, not a full repository replacement. It does not change `package.json`, Node version, Vercel settings, Supabase migrations, environment variables, 3D assets or existing customer saves.
