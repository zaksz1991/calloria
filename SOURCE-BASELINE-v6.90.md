# CALLORIA v6.90 — Source baseline

Inspected on 21 November 2026 against the public `main` branch of `github.com/zaksz1991/calloria`.

## Confirmed integration points

- `js/main.js` persists the employee state under `calloria.save.v1` and can use organization-scoped `calloria.save.*` keys. Legacy guest data may exist under `floorshift3d.save.v1`.
- The saved state contains the active-shift flag, employee status, simulator clock, shift elapsed minutes, inbound queue, digital queue, callbacks, CRM cases, supervisor requests, current inbound/outbound work and assigned digital work identifiers.
- The inbound queue uses `queued` as its waiting status and exposes priority, `queuedAt`, customer, issue and route-group fields.
- Digital contacts use `queued`, `active`, `awaiting_customer`, `pending_customer`, `resolved` and `escalated` statuses. Contact records contain channel, priority, received time and SLA target fields.
- Reopened CRM case follow-ups store their status, priority, due day and due minute under `case.lifecycle.followUp`.
- The main application exposes navigation targets for `inbound`, `queue`, `outbound`, `digital`, `crm` and `supervisor`.

## Integration approach

The command-centre module loads immediately before `js/main.js`. It observes writes to existing application save keys by wrapping `Storage.prototype.setItem`, calls the original method, then derives a display-only snapshot. It also handles cross-tab `storage` events and browser visibility changes.

The pure priority engine does not write to local storage or mutate the supplied state. It uses the same shift simulation clock model as the application for queue timestamps and case follow-up due times. For digital SLA display it mirrors the public digital SLA engine's channel targets, per-contact target, 75% risk threshold and first-response outcome logic.

## Deployment compatibility boundary

The public `main` source inspected for this overlay identifies its shell as `CALLORIA · BUILD 1.4.0`. Earlier supplied Vercel logs identify package version `0.3.0` and show a different Vite transform chain. This overlay's replacement `index.html` targets the public `main` shell, not an un-reconciled `0.3.0` checkout. Confirm the checkout and deployed commit before replacing the root HTML file.

This is an overlay, not a complete repository archive. It does not contain the full `js/` tree, Vite configuration, package files, Supabase source, environment configuration, `public/assets/` or GLB binaries.
