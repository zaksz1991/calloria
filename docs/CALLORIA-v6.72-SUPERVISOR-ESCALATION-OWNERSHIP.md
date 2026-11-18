# CALLORIA v6.72 — Supervisor Escalation Ownership & Response Control

## Purpose

v6.72 turns the existing supervisor assistance list into a controlled escalation work queue. Every request receives a severity, a response target, a named supervisor owner, a work stage and an evidence-backed outcome. It extends the v6.60 Supervisor Live Operations command centre and the v6.70/v6.71 customer promise and reopened-case workflows.

## Supervisor workflow

1. Open the Supervisor desk while using an employee profile.
2. Review the escalation cards. Security, credential, fraud, safety and critical-compliance language is classified Critical by the local rules; case follow-up, callback and complaint language is normally High; other requests default to Normal.
3. Claim an unassigned request. A request already owned by another supervisor cannot be claimed by a second name.
4. For a CRM case or callback promise, open its linked review workspace after claiming the request. The linked workflow checks that the assigned supervisor is the reviewer before it can close the escalation.
5. For a general assistance request, record a decision and at least 30 characters of action/evidence before resolving it.
6. Reassign ownership only with a different supervisor name and a documented reason. The transfer is retained in the escalation history.

## Response targets

| Severity | Default target |
|---|---:|
| Critical | 5 minutes |
| High | 15 minutes |
| Normal | 30 minutes |

The response clock uses local browser wall time and is intended as a visible gameplay control. The targets are illustrative, not contractual or regulatory SLAs. Organisations would need to configure and approve their own policy before these values could be treated as operational standards.

## Legacy data and integration

- Older records in `state.supervisorRequests` are normalised when the save is loaded and again when the Supervisor desk renders.
- Existing fields such as `id`, `contactId`, `reference`, `customer`, `reason`, `channel`, `caseReference`, `commitmentId`, `status` and `createdAt` are retained.
- New metadata is stored under each request's `escalation` property.
- Resolved linked requests receive a matching escalation closure record after the case/promise engine records its domain decision.
- No SQL migration, Supabase secret, environment variable or new dependency is required.

## Updated files

- `js/supervisor-escalation-engine.js` — normalisation, severity, response risk, ownership, reassignment, resolution and metrics.
- `js/main.js` — save migration, supervisor desk UI, claim/reassign/resolve actions and linked CRM/promise review guards.
- `styles.css` — responsive escalation cards and supervisor forms.
- `package.json` — adds the engine to the syntax check.
- `CHANGELOG.md` — v6.72 release record.
- `tests/supervisor-escalation-engine-v672.test.mjs` and `tests/supervisor-escalation-ui-v672.test.mjs` — new regression coverage.
- `tests/case-lifecycle-ui-v671.test.mjs` — updates the existing supervisor-to-CRM assertion for the v6.72 ownership card.

## Verification boundary

The focused v6.71 case-lifecycle plus v6.72 engine/UI regression suite is used for this release. It does not prove the full repository test suite, browser rendering, production build, remote services or Vercel deployment. All generated customers and events remain synthetic gameplay data.
