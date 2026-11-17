# CALLORIA v6.63 — Digital First-Response SLA Control

## Purpose

Add an explicit first-response service-level clock to the existing synthetic digital contact operations. The clock is visible to agents and supervisors, uses the same accelerated shift time as digital intake and queue operations, and records a permanent first-response outcome on each contact timeline.

## Added

- A dedicated deterministic SLA engine in `js/digital-sla-engine.js`.
- Per-contact first-response deadline calculation using the contact's stored `slaMinutes`. If a legacy or malformed contact has no valid target, the engine falls back to channel defaults: Email 240 minutes, Live chat 2 minutes and Social 20 minutes.
- A configurable risk-window threshold with a default of 75% of the response target elapsed.
- Four visible states: On track, Due soon, SLA breached and Met target. A first response after the deadline remains marked late; later customer follow-ups do not reset or erase the original result.
- One-time timeline events when an open contact enters the risk window, breaches the deadline or receives a timely first response.
- Agent work-tab and active-thread SLA indicators, plus per-contact remaining/overdue labels in the waiting digital queues.
- Agent digital service metrics for open backlog, at-risk contacts, breached contacts, first responses met/late and first-response target rate.
- Supervisor queue visibility for digital response risk and waiting-contact breaches, including a dedicated Digital SLA Breaches summary tile.
- Integration with the existing accelerated shift clock, digital reply flow, operations activity timeline and supervisor queue board.
- Mobile-responsive risk, breach and met-state presentation.

## Default target policy

| Channel | Default simulated first-response target |
|---|---:|
| Email | 240 minutes |
| Live chat | 2 minutes |
| Social media | 20 minutes |

A valid target already stored on a contact takes precedence. Contacts created under an organisation's existing `digitalResponseTargetMinutes` policy continue to use the target saved onto that contact. These values are simulation defaults for gameplay, not contractual or regulator-approved service levels. Organisations must provide and approve their own targets before treating any value as an operational standard.

The risk state begins at 75% of the stored target by default. The engine bounds custom target values and risk thresholds to avoid malformed values creating unbounded timers.

## First-response lifecycle

1. A synthetic contact arrives and receives a `receivedAt` timestamp using the current shift simulation clock.
2. Its saved response target determines the due time.
3. The contact remains On track until 75% of its target has elapsed, then enters Due soon and records one risk event.
4. If the agent does not respond by the deadline, the contact enters SLA breached and records one breach event.
5. When the agent records the first reply, the timer stops. The original response time is classified as Met target or First response late. Customer follow-ups do not restart this first-response timer.
6. The agent and supervisor views use the same calculation so queue indicators and summary metrics remain consistent.

## Boundaries

- These are local fictional digital contacts and simulated first-response targets. No live email provider, social network, web-chat system, customer inbox or external SLA clock is connected.
- SLA transitions are logged to the contact timeline, digital event history and existing operations timeline; no external notification is sent.
- No database migration, new environment variable, API secret, service credential or third-party dependency is added.
- Existing v6.62 concurrent digital workload controls, v6.61 automatic digital demand, v6.60 supervisor operations, v6.59 inbound voice queue and v6.58 Try-It Studio remain in the cumulative source.
- Recruitment and assessments remain the employment entry gate. The core gameplay continues to be actual simulated agent work, customer handling, CRM/case resolution, supervisor/QA accountability and career progression.
