# CALLORIA v6.7 — Social, SMS & In-app Contact Handling

## Purpose

This upgrade completes the channel-specific customer-response workflows in the playable Live Floor. It extends the v6.6 Email and Live Chat workspaces with dedicated handling for Social, SMS and In-app contacts. Voice controls and the 3D office are retained.

## New channel gameplay

### Social
- First response is recorded as a **public reply** with a 280-character limit.
- Later handling stages become **private follow-ups** with a 700-character limit.
- Public replies are blocked when they contain apparent email addresses, phone numbers, long numeric identifiers or customer/case references.
- Password, PIN, passcode and one-time-code requests are blocked in both public and private responses.
- The workspace prompts the agent to move account-specific investigation into a private support route.

### SMS
- Dedicated service-SMS composer for each of the three customer-care stages.
- Up to three estimated SMS segments: 459 UTF-16 code units for GSM-compatible text or 201 UTF-16 code units for Unicode text.
- Approximate GSM-compatible / Unicode segment and character estimates are recorded with the interaction.
- Promotional wording is blocked unless the contact record contains explicit `smsMarketingConsent: true` or `consent.smsMarketing: true`.
- Support replies are kept separate from promotional campaigns. Do not assume marketing consent from a customer merely contacting support.

### In-app
- Dedicated in-product response workspace.
- Opening response can acknowledge and orient the customer.
- Later responses require a clear in-product action such as opening Settings, selecting a menu or refreshing a product view.
- Agents are prompted to explain what result the customer should report back.

## Shared workflow

- The agent must prepare one safe customer-facing reply for each of the three service stages.
- A service decision cannot be selected until the current response is prepared.
- After the service decision, the authored reply replaces the generic scripted outbound text in the interaction transcript.
- Drafts, response preparation, sent-stage records, route visibility, response timing and channel-specific quality evidence are saved with the active browser-local interaction.
- All three replies are mandatory before wrap-up.
- Completed contact rows and the end-of-shift report include Social, SMS and In-app activity; SMS segment estimates are also counted.
- The existing Email and Live Chat workflows are preserved.

## Installation

This is an additive overlay for the existing CALLORIA v6.6 Live Floor. Copy these files from the ZIP's `public/` folder into the repository's existing `public/` folder, replacing matching files:

1. `live-floor.html`
2. `live-floor.css`
3. `live-floor.js`
4. `social-messaging-engine.js` — new engine
5. `digital-channel-engine.js` — unchanged v6.6 compatibility copy; retain the matching existing copy if it has local changes.

Keep the existing dependencies and assets already required by the Live Floor:

- `agent-workbench-engine.js`
- `customer-journey-engine.js`
- `live-floor-engine.js`
- `career-progression-engine.js`
- `office-routine-engine.js`
- `customer-dynamics-engine.js`
- `voice-call-engine.js` (v6.5)
- the complete `public/assets/models/` directory and 3D workplace files

Do not replace the Vite configuration, Supabase settings, office-floor page or unrelated modules. No new environment variables are required.

## Route

The existing route remains:

`/live-floor.html`

The new engine is served from:

`/social-messaging-engine.js`

Vite's existing `public/` handling should serve the file without a configuration change.

## Verification performed

- 83 focused and regression tests passed, including v6.6 Email/Live Chat and v6.5 voice regressions.
- JavaScript syntax checks passed.
- HTML duplicate-ID and controller-selector checks passed.
- Social, SMS and In-app session, safety, preparation, transcript and finalisation rules passed.
- ZIP archive integrity passed.
- Static local asset HTTP checks passed.

A full repository Vite build, Vercel deployment, actual live-site test and full browser end-to-end gameplay test were not performed.

## Boundaries

This is a simulation, not a connected social inbox or messaging provider. It does not publish public social replies, send direct messages or SMS, open a real in-app support thread, contact a live customer or connect to external platform APIs. Customer replies remain scripted. All new state remains in browser local storage on the same browser and origin.

SMS segmentation is an estimate, not a carrier billing calculation. The SMS promotional-content guard is a gameplay safety rule, not a substitute for a complete consent-management or legal compliance system. Public social privacy checks are pattern-based and cannot guarantee detection of every sensitive identifier. Human judgement remains necessary.

No Groq key, external AI service, live microphone, telephone system or new third-party dependency is used.
