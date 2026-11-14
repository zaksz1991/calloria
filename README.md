# CALLORIA v6.52 — RuffNeck Platform Support Case Desk

## What this adds

The v6.51 Workforce service directory becomes an operational support-case workspace for each of the six RuffNeck services: LMS, Prospector, Connect, Social Hub, Kano Run and Kano Keke.

An agent can open a synthetic case with a customer reference, request type, priority and issue evidence. Each case receives a simulated response target:

- Critical: 30 minutes and automatic escalation.
- High: 2 hours.
- Normal: 24 hours.
- Low: 48 hours.

Agents can move cases to In Progress, Escalated or Resolved. Each update requires a written action or resolution note and is retained in the case history. New cases are copied to the existing local CRM case list and the operations timeline. CRM displays the service, priority and due time. These support records are marked as not QA-scored so they do not create a false quality percentage.

Credential-like values, long number strings, email addresses and phone numbers are redacted from case notes before they are saved.

## Data and integration boundaries

This is a browser-local simulation. It does not read or change RuffNeck production platform data, send external tickets, call APIs, create real service commitments or write these synthetic cases to Supabase. The SLA values are training targets only. External service links remain informational and open separately.

## Cumulative overlay

This ZIP carries the CALLORIA build plugins and tests from v6.42 through v6.52, plus the matching replacement `vite.config.js`. It does not contain the full application source, package files, Supabase configuration or GLB models. Keep the existing core project files and assets.
