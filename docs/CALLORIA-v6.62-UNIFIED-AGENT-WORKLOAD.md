# CALLORIA v6.62 — Unified Agent Workload & Digital Concurrency

## Purpose

Move the synthetic digital agent desk from a single-contact-at-a-time interaction into a bounded multichannel workbench. Agents can keep several digital assignments open, switch between conversations, and accept more work only when channel-specific and total response capacity allow it.

## Added

- A dedicated deterministic workload engine (`js/agent-workload-engine.js`).
- Three simultaneous active digital response slots per agent.
- Channel limits within the global cap: up to two active email threads, two live chats, and one social conversation; the global three-slot cap always applies.
- Customer-waiting threads remain assigned on the agent's worklist but do not consume an active response slot.
- Assigned digital threads appear as selectable work tabs. A contact remains on the worklist until disposition is recorded.
- A compact waiting queue remains visible while a digital thread is open, allowing an agent to accept additional eligible contacts without abandoning the current conversation.
- Capacity-aware acceptance and customer-follow-up resumption. The UI disables assignments that exceed the active channel or global limit and explains the blocking reason.
- Voice, outbound and after-contact work are mutually exclusive with active digital responses. Pending-customer digital threads may remain assigned while the agent returns to other eligible work.
- Agent state is recalculated as digital work becomes active, moves to customer-waiting, resumes or completes.
- Existing single-contact local saves migrate into the new assigned-work list without discarding their current thread.
- Supervisor queue metrics now count concurrent active digital response threads and separately identify threads awaiting customers.
- Responsive desktop/mobile work tabs and queue controls.

## Capacity model

| Work type | Active concurrency |
|---|---:|
| Email | 2 |
| Live chat | 2 |
| Social media | 1 |
| Total active digital responses | 3 |

The channel limits are upper bounds, not additive guarantees. For example, an agent may handle two chats and one email, or two emails and one social conversation, but never more than three active digital responses overall.

A thread marked `awaiting_customer` remains assigned and visible. It consumes no active response slot until the agent receives the scripted customer follow-up, at which point capacity is checked again.

## Integration behaviour

- `digitalActiveId` remains as the selected-thread compatibility field.
- `digitalActiveIds` stores the set of open assigned contacts for the current agent save.
- The authoritative worklist is reconstructed from open queue records assigned to the current employee reference. This also repairs older saves that did not have `digitalActiveIds`.
- Completing a thread writes the existing CRM case record and releases its assignment.
- No database migration, provider credential, external inbox, telephone integration, or new third-party dependency is introduced.

## Product boundary

All contacts remain fictional local simulator records. This feature does not connect to real email, social, live-chat or telephony providers. Recruitment remains the employment entry gate. The main gameplay remains simulated agent work, operational performance and career progression.
