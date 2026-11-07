# CALLORIA Phase 13 — Voice Practice Studio & Conversation Quality Engine

**New staff page:** `/voice-simulator.html`  
**Agent Desk navigation:** updated `agent-desk.html`  
**New browser modules:** `js/voice-simulator-engine.js`, `js/voice-simulator-workbench.js`  
**New stylesheet:** `styles/voice-simulator.css`

Phase 13 adds a structured role-play environment for training CALLORIA staff across the RuffNeck portfolio, games, complaints, security and the personal-guidance department. It is a practice simulator, not a live telephony connection.

## Included capabilities

- Sixteen scripted practice scenarios covering RuffNeck Learn, Prospector, Connect, Social Hub, Kano Run/Kano Life, Kano Keke, customer complaints, security, relationships, parenting and career development.
- Inbound support and outbound complaint-callback practice.
- English, Hausa, Yoruba, Igbo and Nigerian Pidgin sample scripts. Native-speaker review is required before using translated scenarios as formal language-proficiency assessments.
- Persona and emotional-state feedback. Empathy, discovery and appropriate guidance can reduce simulated customer tension; an unconsented or premature sales pitch increases it.
- Professional greeting, empathy, open discovery, safe verification, accurate explanation, step-by-step guidance, understanding confirmation, consent, referral, safeguarding escalation and closing actions.
- Optional browser text-to-speech for the latest customer line. Voice availability depends on the installed browser/device language packs.
- Hold and resume controls. Hold time is excluded from active handling time, and speed does not increase the score.
- After-contact work and a structured practice disposition.
- A seven-part quality rubric weighted to 100. A critical security, privacy, consent or safeguarding failure blocks a pass regardless of the numerical score.
- Local practice history scoped to the signed-in staff UUID. It stores scenario, score, disposition and competency gaps, not conversation transcripts or the outcome-summary free text.

## Mandatory quality rules

- Never request a password, passcode, OTP, PIN, CVV, full payment-card number or API secret.
- On verification-required scenarios, do not disclose case or account details before the simulated approved verification step.
- Suspicious-code and safeguarding scenarios require the safeguarding hand-off to pass.
- Customer-requested product information can be answered as requested. Proactive cross-selling requires a separate affirmative marketing-consent step and a confirmed outcome on the original issue. Service consent is not marketing consent.
- Personal guidance is general and non-clinical. It does not diagnose, prescribe treatment or replace a qualified professional. Immediate danger or clinical risk must be escalated to qualified human support.
- Product information in the scripts is high-level. Staff must verify current feature availability, account status, pricing and limits in the relevant owning platform before making commitments.

## Authentication and data boundaries

- The page uses the existing Supabase browser configuration (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`).
- Staff authentication is checked by the existing `calloria-agent-desk` Edge Function `whoami` action and its existing `CALLORIA_AGENT_WORKSPACE_ACCESS` permission map.
- No new Supabase table, migration, Edge Function, function secret or service-role credential is introduced.
- Practice history is saved only in this browser's local storage under a key scoped to the staff Auth UUID. It is not synchronised between devices or sent to Supabase.
- No microphone capture, speech recognition, call recording, customer data ingestion, external call, message, provider connection or AI/Groq request is made.
- Practice scores are training feedback only. They do not enter official monthly scorecards, QA reviews, promotion eligibility, payroll or disciplinary workflows.

## Integrate on the Phase 12 baseline

This is an incremental overlay for a repository that already contains the Phase 12 routing integration and all earlier phases. It is not a complete CALLORIA repository snapshot.

### Add

| Package file | Repository path |
|---|---|
| `voice-simulator.html` | `voice-simulator.html` |
| `js/voice-simulator-engine.js` | `js/voice-simulator-engine.js` |
| `js/voice-simulator-workbench.js` | `js/voice-simulator-workbench.js` |
| `styles/voice-simulator.css` | `styles/voice-simulator.css` |
| `tests/voice-simulator-engine.test.mjs` | `tests/voice-simulator-engine.test.mjs` |
| `tests/voice-simulator-contract.test.mjs` | `tests/voice-simulator-contract.test.mjs` |

### Replace with the complete merged files included

- `agent-desk.html` — Phase 12 Agent Desk page with a Voice Practice navigation link.
- `vite.config.js` — Phase 12 multi-page Vite inputs plus `voice-simulator.html`.
- `package.json` — Phase 12 dependency/script baseline with syntax checks for the two new browser modules.

Review local changes before replacing those three files. Preserve any later edits in the actual repository. Do not replace `index.html`, the 3D game entry points, existing world/renderer files, existing Agent Desk workbench, Supabase functions, knowledge catalogue, migrations or any prior phase modules with older snapshots.

## Build and deployment boundaries

- No Supabase migration is required.
- No Edge Function deployment is required; the page calls the existing Agent Desk `whoami` endpoint solely to check staff authorisation.
- The Vite multi-page configuration must include the new page or a direct deployed route may return 404.
- The browser must already have the same public Supabase configuration and the existing Agent Desk function access map configured.
- A full production build and browser end-to-end test require the complete user's Phase 12-integrated CALLORIA checkout. The overlay workspace does not contain the complete 3D simulator or every earlier phase file.
