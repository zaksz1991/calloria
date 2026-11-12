# CALLORIA v6.8 — Intelligent Omnichannel Routing & SLA Control

## Purpose

This upgrade improves how the existing Live Floor presents the synthetic customer queue. It adds team-aware skill profiles, explainable routing priority, SLA visibility and a recorded routing snapshot for each accepted contact. It keeps customer handling as the centre of gameplay; it does not turn CALLORIA into a finance or back-office simulator.

## New gameplay

### Explainable next-best-contact routing
- Ranks the current queued contacts using priority, SLA pressure, time waiting and agent skill fit.
- Highlights the recommended next contact and the reasons it is recommended.
- Shows breached, at-risk, due-soon and within-target SLA states.
- Displays estimated remaining or overdue response time, waiting age and channel/product skill fit.
- Refreshes queue timing and recommendations every 30 seconds when no contact is active and the skill editor is not being used.

### Team-aware skill profile
- Loads a default skill profile from the selected team: Customer Care, Digital Support, Player Support, Technical Support, Service Recovery or General Enquiries.
- Allows the player to adjust proficiency for all six contact channels and all seven RuffNeck products/services.
- Skill levels: Basic, Working and Advanced.
- Saves profiles locally per employee name and assigned team, so one player profile does not overwrite another employee's profile on the same browser.
- Changes immediately update queue ordering and the recommendation explanation.

### Queue controls
- Smart routing (default), Priority first and Oldest waiting sorting modes.
- Existing channel filtering is retained.
- Skill suggestions are advisory: an agent can still choose any queued contact. The game does not lock the player out of a customer because a profile skill is low.

### Performance evidence
- Captures routing mode, score, skill fit, queue wait, SLA state at acceptance, channel/product proficiency and assigned team when a contact is accepted.
- Adds routing evidence to completed contact records and the end-of-shift report.
- Preserves the v6.7 Voice, Email, Live Chat, Social, SMS and In-app contact workflows, including the earlier customer dynamics, career and office routine integrations.

## Installation

This is an additive overlay for the existing CALLORIA v6.7 Live Floor. Copy the following six files from the ZIP's `public/` folder into the repository's existing `public/` folder, replacing matching files:

1. `live-floor.html`
2. `live-floor.css`
3. `live-floor.js`
4. `digital-channel-engine.js` — unchanged v6.6 compatibility copy; retain your matching existing copy if locally customised.
5. `social-messaging-engine.js` — unchanged v6.7 compatibility copy; retain your matching existing copy if locally customised.
6. `queue-routing-engine.js` — new v6.8 engine.

Keep all other Live Floor dependencies and assets already in your repository:

- `agent-workbench-engine.js`
- `customer-journey-engine.js`
- `live-floor-engine.js`
- `career-progression-engine.js`
- `office-routine-engine.js`
- `customer-dynamics-engine.js`
- `voice-call-engine.js`
- the existing complete `public/assets/models/` directory and 3D workplace files

Do not replace the Vite configuration, Supabase configuration, 3D office pages, or unrelated modules. No environment variables or external API keys are required.

## Route

The existing Live Floor route remains:

`/live-floor.html`

The new engine is served at:

`/queue-routing-engine.js`

## Verification performed

- **109 focused and regression tests passed, zero failed.** This includes the v6.5 voice regressions, v6.6 email/chat checks, v6.7 social/SMS/in-app checks, and new v6.8 routing/queue tests.
- JavaScript syntax checks passed for all JavaScript files in the overlay.
- HTML duplicate-ID check passed.
- All 153 direct controller ID selectors were found in the HTML.
- Local HTTP checks returned 200 for the Live Floor page, stylesheet, controller, new routing engine and required compatibility/runtime dependencies.
- ZIP archive integrity passed.

A headless Chromium page-render attempt timed out in this environment. A complete repository Vite production build, deployment to Vercel and live-site browser verification were not performed.

## Boundaries

- The queue remains the ten synthetic demonstration contacts supplied by the existing Live Floor engine; this is not a connection to a live ACD/omnichannel platform.
- Routing is single-player decision support. It does not assign contacts across multiple real agents, teams or organisations.
- SLA clocks are simulated from the timestamps on the local queue records. The rules are a game model, not a contractual service-level engine.
- Skill profiles and routing evidence remain in browser local storage on the current browser and origin. They are not synced to Supabase or a central HR/CRM database.
- Skill-fit and priority scores are transparent game heuristics, not a certified workforce optimisation or Erlang-C model.
- The agent retains contact choice; a low skill match displays a suggestion instead of blocking the contact.
- No real calls, emails, messages, AI service, external queue, microphone, or customer records are accessed. No Groq key or new third-party service is used.
