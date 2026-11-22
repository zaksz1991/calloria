# CALLORIA v7.19 — Digital Resolution Evidence Integrity

Additive overlay for the existing synthetic email, live-chat and social support workflow.

## Why this exists

The current digital after-contact form asks for a disposition and factual case notes. The current `completeDigitalContact()` engine requires at least one agent reply and notes, then accepts `resolved`, `pending_customer` or `escalated`. It does not require evidence that the selected outcome is supported by the conversation. This overlay adds that check before the existing completion function runs.

## Behaviour

- `resolved` requires either a customer reply after an agent response, or a one-touch resolution with no pending scripted customer response.
- A conversation flagged as needing supervisor intervention cannot be resolved until the linked supervisor request has a recorded reviewed/closed/completed state.
- `pending_customer` requires the explicit customer-information-pending evidence code.
- `escalated` requires the specialist-referral evidence code and a linked open or reviewed supervisor request.
- Factual notes must contain at least 20 characters.
- The saved synthetic CRM case receives a `dispositionEvidence` object with evidence type, label, simulated timestamp, note length and whether a customer reply was observed.

The evidence gate is deterministic and read-only until the existing completion call succeeds. It does not award QA points, change salary or promotion, call external inbox providers, or require a Supabase migration.

## Files

- `js/digital-disposition-integrity-v719.js` — pure disposition validation.
- `build/calloria-digital-disposition-integrity-v719.mjs` — source-safe Vite transform for `js/main.js`.
- `tests/digital-disposition-integrity-v719.test.mjs` — focused validation and transform regression tests.
- Installation, baseline, verification and changelog documentation.

## Install scope

Register the supplied plugin once at the end of the existing Vite plugin array. Keep all other plugins and their order. This is an overlay, not a full repository replacement.
