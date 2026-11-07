# CALLORIA v1.1.0

## Customer Intelligence & Adaptive Contact Simulation

- Added eight synthetic customer personas: calm, angry, confused, older customer needing a slower pace, technically challenged, suspicious, repeat complainant and time-pressured business customer.
- Added six scenario families covering duplicate debits, mobile access, suspected fraud, failed transfers, service information and repeat complaints.
- Added a Customer Lab workspace with configurable persona, issue and contact channel.
- Added adaptive customer reactions and up to three interaction turns. Critical unsafe conduct ends the interaction and triggers mandatory review.
- Added transparent deterministic practice QA for greeting, acknowledgement, ownership, probing, next-step clarity and communication clarity.
- Added flags for credential solicitation, full card-detail solicitation, unverified guarantees and dismissive language.
- Added final QA reports, coaching recommendations, aggregate practice metrics and recent history.
- Preserved the v1.0.0 recruitment, employment, voice, digital, workforce, organisation and cloud modules.

## Boundaries

- Customer identities and all scenario data are synthetic.
- The evaluator is rule-based; it does not call an AI provider and is not certified QA.
- Customer Lab history is currently stored in the existing local employment snapshot. It is not a separate server-backed table.
- No live calls, messages, customer records or bank systems are accessed.
