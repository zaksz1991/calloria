# CALLORIA v7.22 — Digital Experience Suite Activation

A cumulative activation package for the digital workflow features already present in the public repository.

## Why v7.22 exists

The public `main` Vite configuration currently ends with `calloriaTryItStudioPlugin()` and does not import or register either the v7.20 Digital Workflow Suite or the separate v7.21 Digital Response Cycle plugin. The v7.20 and v7.21 source modules exist in the repository, but without Vite registration their transforms are not active in the application build.

v7.22 replaces the current Vite config with a source-matched version that adds one final plugin registration. That plugin invokes the v7.20 digital workflow in its existing deterministic order, then applies v7.21 multi-turn response-cycle SLA UI.

## Included features

- v7.15 digital response quality coach and hard privacy blockers.
- v7.16 accurate distinction between active threads awaiting customer and CRM pending-customer cases.
- v7.17 specialist handoff draft and supervisor routing.
- v7.18 SLA-first digital queue triage with bounded ageing fairness.
- v7.20 digital disposition evidence gate.
- v7.21 follow-up response-cycle SLA for subsequent customer turns.
- One v7.22 Vite suite registration, with source-drift checks and idempotency.

## Package scope

This is an additive overlay plus a complete replacement `vite.config.js`. It is not a complete CALLORIA repository. It intentionally does not replace `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `vercel.json`, `.env` files, Supabase configuration, application pages, or public 3D assets.
