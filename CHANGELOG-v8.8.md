# CALLORIA v8.8 — Cloud Recovery Progress Tracking

## Added
- A checklist on each guided cloud-recovery card. Individual recovery steps can be marked complete and reset without leaving the Workforce History panel.
- Recovery checklist progress persists in browser-local storage and is namespaced per organisation. Switching organisations loads a separate checklist.
- Progress records contain only fixed diagnostic IDs and step indexes. The raw organisation ID, account information, diagnostic errors, employee details and customer data are not stored in the checklist record.
- Each card shows completed steps and a percentage. Completing all checklist items is explicitly labelled as self-reported, with verification still pending.
- A fresh read-only health check remains the source of truth. When a check passes, its stale checklist progress is pruned from the current runbook.
- Safe fallback when browser storage is blocked or unavailable: the checklist remains usable during the current session and the interface reports that it may not survive a reload.
- Keyboard focus, accessible labels, and narrow-screen checklist layouts.

## Preserved
- v8.1–v8.7 cloud history, conflict review, backup verification, health diagnostics and guided remediation.
- Existing Node 22, Vite, Three.js and Supabase dependency pins.
- Existing database, RLS and organisation-role boundaries.

## Not included
- No Supabase migration, RPC, Edge Function, secret or Vercel environment-variable change.
- No automatic database repair, synchronisation, backup restore or permission escalation.
