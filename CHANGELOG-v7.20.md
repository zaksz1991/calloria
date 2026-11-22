# Changelog — CALLORIA v7.20

## Digital Workflow Suite Integration

- Consolidates the v7.15–v7.18 transforms and the disposition-evidence gate into one Vite suite registration.
- Fixes the v7.19 anchor conflict caused by the v7.17 specialist-handoff insertion.
- Moves evidence validation to the completion call anchor and outcome-field insertion to the case-notes field anchor.
- Allows a validated v7.17 specialist handoff draft to satisfy the referral-exists check during the same disposition transaction, before the draft is committed to the supervisor request ledger.
- Preserves explicit evidence checks for resolved, pending-customer and escalated outcomes.
- Adds full-chain transform, idempotency, syntax and helper regression coverage.

## No changes

- No Supabase schema or environment changes.
- No live email, WhatsApp, social or SMS provider connections.
- No edits to the base `main.js`, `multichannel-engine.js`, `package.json`, `vite.config.js` or `vercel.json` are shipped. The Vite change is a documented two-line manual integration.
