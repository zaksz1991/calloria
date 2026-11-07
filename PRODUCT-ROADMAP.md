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
