# CALLORIA v6.74 — Agent Shift Handover & Open Work Continuity

## Purpose

v6.74 adds a formal agent-to-agent handover for customer work that must continue when an agent's shift ends. It complements the existing v6.73 supervisor escalation handover: v6.73 transfers supervisor-owned escalations, while v6.74 transfers eligible frontline work owned by an outgoing agent.

## Eligible work

The handover candidate list can include:

- Active or awaiting-customer digital conversations assigned to the outgoing agent's existing employee reference.
- Open callback commitments owned by the outgoing agent. Their due date, due time, attempt history and linked scheduled callback task remain intact.
- Open reopened-case follow-ups owned by the outgoing agent. On acceptance, the follow-up changes to `open`, its prior claim is cleared, and the incoming agent must explicitly claim it before continuing. Its priority and simulated due time remain unchanged.
- Other open CRM case records owned by the outgoing agent, excluding resolved/completed cases and cases already represented as an active reopened follow-up.

Active voice calls, active outbound conversations, after-contact work and supervisor-owned escalation records are not transferred by this workflow.

## Workflow

1. The outgoing agent opens **Handover** and reviews currently owned, eligible work.
2. The agent enters the incoming agent's name and records a note containing customer risk, completed checks and the next required action.
3. Preparing a handover snapshots item references but does not change any ownership. A work item cannot be placed in a second pending handover.
4. The named incoming agent accepts the handover.
5. Acceptance re-checks each live record. Still-open work owned by the outgoing agent transfers; records that were closed, completed, removed or reassigned are marked stale and skipped.
6. Digital conversations retain their message history and gain an ownership event in their timeline. Callback commitments retain their due plan and callback links. Case and follow-up histories record the transfer.
7. The outgoing agent can cancel a pending handover with a reason. Cancellation leaves all current work ownership unchanged.

## Save and data compatibility

- Handover records are saved in the existing application profile as `agentHandovers`.
- Existing application saves are migrated by adding an empty list when this field is absent and normalising new handover records when present.
- Digital work continues to use the existing `assignedTo` employee reference convention (`EMP-` plus the user's current initials).
- Callback commitments remain in the existing `customerCommitments` store. Scheduled callback tasks are not recreated or duplicated; their original `commitmentId` remains linked.
- Case records, customer history, interaction notes and existing timelines are preserved. Only eligible ownership and follow-up claim fields change after acceptance.
- No database migration, environment variable, secret, external provider or new npm dependency is added.

## Identity and operating boundaries

- This is still the local synthetic gameplay save. Typing the incoming agent's name is a simulated acknowledgement, not authenticated enterprise identity.
- There is no server-side multi-agent concurrency lock, external notification, cross-device real-time synchronisation or proof that the named person accepted the work.
- Employee references based on initials retain the existing local prototype convention and are not suitable as enterprise identity keys.
- Handover due labels are descriptive snapshots. The authoritative due date/time remains on the original commitment or follow-up record.
- Recruitment remains the entry gate. The main gameplay remains employed agent operations, customer resolution, supervisor accountability and career progression.

## Updated files

- `js/agent-handover-engine.js` — candidate collection, pending-item reservation, create/accept/cancel transitions, stale-item handling and metrics.
- `js/main.js` — local-save migration, Agent Handover view, event handlers and operation timeline entries.
- `index.html` — first-class Handover navigation entry.
- `styles.css` — responsive worklist, handover card and form styling.
- `package.json` — syntax-check coverage for the new engine.
- `tests/agent-handover-engine-v674.test.mjs` and `tests/agent-handover-ui-v674.test.mjs` — engine and application integration regression tests.
- `CHANGELOG.md`, this document, installation instructions and verification report — release records.

## Verification boundary

See `VERIFICATION-v6.74.md`. Automated unit and UI contract checks cover the local transition rules. Production Vite build, browser walkthrough, multi-user server authentication and Vercel deployment are separate acceptance checks and are not implied by passing these tests.
