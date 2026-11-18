# CALLORIA v6.73 — Supervisor Shift Handover & Outstanding Work Continuity

## Purpose

v6.73 adds a formal handover between outgoing and incoming supervisors. It prevents open supervisor escalations from being abandoned when an operating shift changes and makes the transfer explicit, reviewable and recorded in the same local simulation state as the existing supervisor assistance queue.

## Workflow

1. The outgoing supervisor opens the Supervisor desk and reviews the escalations assigned to their name.
2. The handover preview lists only open requests currently owned by that supervisor. Requests already included in another pending handover are excluded.
3. The outgoing supervisor names the incoming supervisor and records a handover note describing customer risk, action already taken and the outstanding next step.
4. Creating a handover does not change escalation ownership. The requests remain assigned to the outgoing supervisor while acceptance is pending.
5. The named incoming supervisor acknowledges the handover. The engine re-checks every request at acceptance time.
6. An open request still owned by the outgoing supervisor transfers to the incoming supervisor. Its escalation stage becomes acknowledged, its prior in-progress timer is cleared, and an ownership-transfer event is appended to the request history.
7. A request that has been closed, deleted or reassigned since the handover was prepared is marked stale and skipped. The current request owner is never overwritten.
8. The outgoing supervisor may cancel a pending handover with a documented reason. Cancellation does not change any request ownership.

## Data and operating boundaries

- Handover records are stored in the existing local browser save as `supervisorHandovers`.
- Existing `supervisorRequests` and escalation history records are retained; no historical case, commitment or callback is deleted.
- Handover items store a snapshot of the request reference, customer display name, channel, reason, priority, response target and original owner. The acceptance step always checks the current request before transferring it.
- All names, customer records, queues and actions remain synthetic gameplay data.
- The incoming supervisor name is a simulated acknowledgement, not an authenticated enterprise identity. No server-side workforce validation, external notification or cross-device handover sync is added.
- No Supabase migration, new environment variable or new dependency is required.
- Recruitment remains the employment entry gate. The main gameplay remains contact-centre agent work, supervisor operations and career progression.

## Updated files

- `js/supervisor-handover-engine.js` — normalisation, ownership-filtered candidate selection, create/accept/cancel transitions, stale-item handling and metrics.
- `js/main.js` — save migration, Supervisor desk UI and audited handover submission handlers.
- `styles.css` — responsive handover metrics, preview, cards and forms.
- `package.json` — adds the new engine to the syntax check.
- `CHANGELOG.md` — v6.73 release notes.
- `tests/supervisor-handover-engine-v673.test.mjs` and `tests/supervisor-handover-ui-v673.test.mjs` — new regression coverage.
- `tests/promise-control-ui-v670.test.mjs` — updates an older source assertion to match the v6.72 assigned-owner review card while preserving its Promise Control navigation and no-one-click-close checks.
- `docs/CALLORIA-v6.73-SUPERVISOR-SHIFT-HANDOVER.md` and `VERIFICATION-v6.73.md` — feature and verification notes.

## Verification boundary

See `VERIFICATION-v6.73.md`. Source syntax and automated tests were run locally. The Vite build could not run because Vite is not installed in the provided preparation environment. No live browser session or Vercel deployment is claimed.
