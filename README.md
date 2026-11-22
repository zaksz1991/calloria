# CALLORIA v7.17 — Digital Specialist Handoff & Supervisor Routing

This is an additive source overlay for the current CALLORIA public `main` source structure.

## What it adds

When an agent chooses **Escalated to specialist team** in the synthetic digital-contact after-contact form, CALLORIA displays a required specialist destination and a concise reason field. A valid handoff creates or augments an item in the existing local Supervisor Escalations queue and links it to the resulting CRM case.

Allowed destinations:

- Cards & Payments
- Transfers Support
- Fraud & Payments
- Digital Support
- Customer Experience
- IT Systems Support
- RuffNeck Product Support
- Life & Advice
- Complaints & Resolution

The handoff is a request, not an automatic transfer. A supervisor must claim and review it using the existing Supervisor Escalations workflow. The package does not route or expose actual WhatsApp/SMS provider conversations and does not change their restricted staff inboxes.

## Package contents

- `js/digital-specialist-handoff-v717.js` — validated handoff data contracts.
- `build/calloria-digital-specialist-handoff-v717.mjs` — strict, source-aware Vite transform.
- `styles/calloria-digital-specialist-handoff-v717.css` — desktop and narrow-screen presentation.
- `tests/digital-specialist-handoff-v717.test.mjs` — regression tests.
- Installation, source-baseline and verification notes.

## Release boundaries

No Supabase migration, environment variable, live-provider integration, organisation permission change or saved-game schema migration is included. It creates only synthetic supervisor-request and CRM-case fields within the existing local game state.

This ZIP is not a complete repository replacement. Preserve the repository's existing application files, Vite configuration, build manifest, Supabase configuration and public assets.
