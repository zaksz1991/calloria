# CALLORIA product roadmap

## v1.4.0 — Game-first guest access, telemetry and Groq server integration
- Full-screen game launch presentation and optional account flow.
- Adaptive renderer and lazy asset loading.
- Anonymous game analytics and launch-screen sponsor slot.
- Groq-backed AI practice QA, with provider key held in Supabase Edge Function Secrets.

## Next phases

### v1.5 — Real game performance and content
- Browser/device performance benchmark harness (GPU frame time, CPU update time, draw calls, triangles, memory, asset download size).
- In-app Low / Balanced / High presets, saved per device.
- More efficient scene geometry, mesh merging/instancing and texture atlases.
- Progressive environment streaming and locally hosted optimised GLB assets.
- Functional gamepad and improved mobile interaction/comfort.
- Additional first-person tasks beyond station panels.

### v1.6 — Advertiser and sponsor management
- Admin campaign authoring and approvals.
- Sponsorship inventory and placement preview.
- Advertiser contracts, start/end scheduling and campaign status.
- Server-side impression/click reporting, bot filtering and campaign reconciliation.
- In-world signage and approved sponsored learning scenarios.
- Consent and privacy notices for analytics and advertising.

### v1.7 — Public player and community systems
- Verified live concurrency and historical player analytics.
- Guest-to-account progress migration with conflict handling.
- Leaderboards and community events with anti-abuse controls.
- Accurate counts with clearly stated measurement definitions.

### v1.8 — Deeper contact-centre simulation
- More physically interactive desks and office objects.
- Richer NPC routines, customer arrival flows and department-specific scenes.
- Multi-floor progression, training rooms and team spaces.
- Optional voice customer conversations and expanded Groq-assisted practice.

## Product principles
- Guest play is always available for core public gameplay.
- Account creation is optional except where a specific organisation/cloud feature requires authentication.
- CALLORIA data remains separated from other applications sharing the Supabase project.
- Player counters are server-derived and clearly defined; never fabricate player numbers.
- Ads are approved, disclosed and non-obstructive.
- Never claim a performance target without measuring it on representative devices.

## Delivered earlier milestones
- v1.1.0 — Customer intelligence and adaptive contact simulation.
- v1.2.0 — Human QA and supervisor intelligence.
- v1.3.0 — AI-assisted customer intelligence (initial provider implementation; superseded by the Groq configuration in v1.4.0).

## Runtime delivery note — CALLORIA v6.59

The supplied repository now includes the first operational demand-flow increment toward deeper contact-centre simulation: deterministic inbound arrivals during a shift, priority-based customer patience, abandonment, queue capacity and supervisor queue telemetry. This is a partial delivery of richer customer arrival flows, not completion of the broader deeper-simulation roadmap. Real telephony, production dialler integration, enterprise data connectivity, multiplayer and multi-organisation administration remain separate work.


## Runtime delivery note — CALLORIA v6.61

The active shift now generates synthetic email, live-chat and social contacts automatically on separate schedules. Each channel has a waiting-capacity limit and records excess demand as overflow. The agent and supervisor workspaces expose per-channel arrival counters, queue totals and next-arrival information. Standard, Busy period and Recovery demand profiles affect future voice and digital arrivals; the voice pause control remains separate. All simulated digital wait-time and service-risk calculations share the accelerated shift clock. This is an incremental multichannel demand simulation, not a live external inbox, contractual SLA or completion of v0.2 Advanced Contact Centre Operations.


## Runtime delivery note — CALLORIA v6.60

The supervisor workspace now provides local simulated control over the v6.59 inbound arrival flow, a cross-channel voice/digital waiting-work snapshot, SLA-risk indicators, reason-required priority and route triage, and an audit trail. Pausing intake does not freeze waiting-customer patience. This is a meaningful supervisor-operations increment, not a live external call-centre control plane and not completion of v0.2 Advanced Contact Centre Operations. Real provider channels, real-time workforce management, multi-organisation administration and multiplayer remain separate work.

## Runtime delivery note — CALLORIA v6.65

Inbound voice contacts now have one adaptive local customer dialogue model for guided and free-form agent replies. The model tracks synthetic sentiment and patience, can interrupt the agent, can pause for conditional service-recovery decisions, flags prohibited credential requests, and saves the final voice outcome and sanitised transcript into the simulated case record. Supervisor risk indicators describe the active player's voice call. This improves the voice simulation layer; it does not create real telephony, live multi-agent speech monitoring or a production contact-centre provider connection, and it does not complete v0.2 Advanced Contact Centre Operations.


## Runtime delivery note — CALLORIA v6.66

Outbound campaign work now uses the existing synthetic conversation engine directly inside the main agent application. The previous quiz-style outbound steps are replaced by a customer transcript and typed agent response flow, with preference-aware replies, permission checks, opt-out suppression, callback recording, compliance flags, supervisor requests and persisted CRM/attempt histories. Product-offer sales credit requires explicit synthetic customer acceptance. This is simulated gameplay only: no telephone call is placed and no provider is connected. It is a further v0.2 operations increment, not a claim that Advanced Contact Centre Operations is complete.
