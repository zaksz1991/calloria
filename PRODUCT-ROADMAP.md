# CALLORIA Product Roadmap

## v1.3.0 — AI-Assisted Customer Intelligence
Implemented in this package: tenant-controlled model settings; secure Supabase Edge Function gateway; OpenAI Responses API integration; explicit transcript-transfer consent; basic redaction; atomic daily request quota; AI sentiment, intent, summary, QA observations and coaching suggestions; transcript quote checks; human approval boundary. The feature is disabled by default and requires migration 003, Edge Function deployment and server-side provider secret configuration.

## Next priorities
1. v1.4.0 — Realtime operations: event-level persistence, optimistic concurrency, queue presence, authenticated supervisor monitoring and team-shared QA workflow.
2. v1.5.0 — QA recording pipeline: consented audio attachment, secure storage, retention rules, playback permissions and redacted transcript alignment.
3. v1.6.0 — Multi-provider AI gateway: organisation-approved provider adapters, provider-specific budgets, usage analytics, model evaluation and fallback handling.
4. Production readiness: live Supabase migration tests, tenant-isolation tests, build pipeline, accessibility, data-retention enforcement and physical mobile/browser validation.

## v1.1.0 — Customer Intelligence & Adaptive Contact Simulation
Completed: synthetic customer personas, scenario branching, customer patience, transcript history and deterministic practice QA.

## v1.2.0 — Human QA & Supervisor Intelligence
Completed: weighted scorecard versions, transcript-evidence-linked human reviews, coaching actions, reviewer calibration, dispute submission and resolution. The workflow remains a training system; reviewer RBAC and shared server-side QA records are not yet fully implemented.

## Release boundary
The AI assistant is advisory only. No model output can create or edit a human QA score, staff record, promotion decision or compliance finding. Production data must not be sent until a separate privacy, contractual and legal review approves it.
