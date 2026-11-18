# CALLORIA v6.65 — Verification Record

**Release:** Adaptive Voice Customer Behaviour  
**Date:** 17 November 2026  
**Base:** v6.64 cumulative project archive  

## Verification summary

| Check | Result | Evidence / limitation |
|---|---:|---|
| New voice engine + UI tests | **24 passed, 0 failed** | `tests/voice-customer-behaviour-v665.test.mjs` and `tests/voice-customer-behaviour-ui-v665.test.mjs` |
| `npm run check` | **Passed** | Configured syntax gate includes `js/voice-customer-behaviour-engine.js` |
| Full `npm test` | **1,402 passed / 544 failed** | 1,946 total. The 544 failing test names exactly match the v6.64 baseline (1,378 passed / 544 failed across 1,922 tests). The 24 newly added tests passed; no new failing names were introduced. |
| `npm run build` | **Not verified** | Vite was not installed in the preparation workspace (`vite: not found`). |
| Browser / mobile / microphone acceptance | **Not run** | Requires actual browser and device sessions. |
| GitHub push / Vercel deployment | **Not performed** | No deployment is claimed. |

## What was verified

- The new engine is imported by the actual application entry point and its exported API is covered by tests.
- New inbound calls establish a deterministic customer profile and opening transcript. Re-rendering and later turns reuse the active call's saved behaviour state.
- Guided responses and typed / consented speech-to-text responses feed the same conversation state.
- Customer sentiment, patience, emotion, interruptions, negotiation status, quality flags and supervisor risk are evaluated and written into the existing interaction flow.
- Requests for PINs, passwords, one-time codes and payment security details are critical; protective warnings against credential sharing are not misclassified, while mixed statements that still request credentials remain flagged.
- Unresolved service-recovery negotiation remains escalation-required until the agent checks authority; unsupported guarantees create QA flags and supervisor risk.
- Wrap-up and CRM records retain sanitised transcript, customer persona/mood, quality flags, negotiation status, outcome and CSAT estimate.
- The legacy v3.6 source transformer is guarded so it yields to the newer v6.65 voice workflow rather than rewriting the current inbound UI.
- Responsive decision controls are present for customer interruptions and service-recovery choices.

## Known limitations

- This is a simulated customer conversation engine, not live telephone integration. Existing optional browser recording / recognition remains explicit-consent and subject to browser support. No recording or transcript is sent to a telephony provider by this release.
- Customer sentiment and patience are gameplay variables, not clinical or validated psychological measurements.
- Full test suite remains non-green due to the same 544 baseline failure names recorded before this upgrade.
- A production build, browser interaction, mobile rendering, external GLB loading and deployed Vercel verification remain outstanding.
- The supplied project archive does not include `public/assets/` or its GLB models. Keep the user's existing `public/assets/` folder from the GitHub checkout.
