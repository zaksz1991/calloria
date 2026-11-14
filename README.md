# CALLORIA v6.53 — Support SLA Command Centre

## What this adds

The v6.52 platform-support case desk gains a single command centre covering all six RuffNeck services: RuffNeck LMS, Prospector, Connect, Social Hub, Kano Run and Kano Keke.

The Workforce view now includes:

- A cross-platform support queue with active, due-soon, overdue, escalated and resolved views.
- Filters by service and priority, plus nearest-SLA, newest and oldest sorting.
- SLA ageing bars and a remaining/overdue clock on each case.
- Summary counts for active, due-soon, overdue, escalated and resolved cases.
- Automatic escalation when an open or in-progress case passes its simulated response deadline.
- CRM mirror updates, a synthetic system audit event and operations-timeline entries when the watcher detects a breach.
- A 30-second refresh while the browser tab is visible, with an immediate check when the tab becomes visible again.
- Responsive queue layout for narrow screens.

A case already marked Escalated is not escalated repeatedly. Resolved cases remain closed. The dashboard sorts by response deadline by default and supports filters to isolate specific services and priorities.

## SLA rules

The due-soon state begins when 20% or less of the target remains, with a minimum five-minute warning window. An unclosed Open or In Progress case is automatically marked Escalated once its `slaDueAt` passes. The escalation is recorded in the support-case history, mirrored CRM record and local event history.

These are simulated training targets inherited from v6.52. They are not real RuffNeck service commitments, and they do not create or update tickets in the actual RuffNeck platforms.

## Data and integration boundaries

All records remain in the CALLORIA browser save. The command centre does not call RuffNeck platform APIs, does not write ticket data to Supabase, and does not change production systems. The automatic watcher runs only in the open browser session; it is not a server-side background monitor. A suspended or closed browser tab cannot process a deadline until the app is active again.

## Cumulative overlay

This ZIP carries the CALLORIA build plugins and focused tests from v6.42 through v6.53, plus the matching replacement `vite.config.js`. It is an integration overlay, not the complete application repository. It does not contain the full application source, package files, Supabase configuration or GLB models. Keep the existing application files and assets.
