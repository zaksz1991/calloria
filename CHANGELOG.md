# CALLORIA v6.45 — Inbound QA Review Bridge

## Added
- Completed inbound call records are added to the existing Human QA workspace review register.
- The QA workspace now shows a separate inbound review queue with pending and mandatory-review counts.
- The newest pending interaction is selected by default, while an existing reviewer selection is preserved.
- Reviewable evidence is built from the scenario opening, saved live customer/agent dialogue, explicitly logged voice replies, agent workflow choices when no dialogue exists, and the factual case note.
- Duplicate queue records are prevented using the originating contact ID.
- Transcript copies redact credential values, long numeric sequences and email addresses.
- Breached inbound interactions are marked for mandatory review; no automatic human QA score or employee outcome is generated.

## Preserved
- Existing Customer Lab QA records and scorecards.
- Human evidence selection, weighted scorecards, reviewer notes, coaching actions, disputes and calibration.
- Existing inbound case, callback, escalation, queue, KPI and wrap-up flow.
- Existing Supabase settings, API keys, GLB assets and package dependencies.

## Scope boundary
This is a local simulation workflow. It does not create a live telephony QA system, enforce shared supervisor permissions, or make certified employment decisions.
