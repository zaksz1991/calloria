# Changelog — CALLORIA v7.10

## Added
- Context-aware live-call playbooks for security, payments/transactions, technical support, complaints and general service.
- Priority overlays for pending customer decisions, supervisor-risk states and low-sentiment/low-patience de-escalation.
- Four-step handling checklist with page-session-only self-check state keyed by the synthetic contact reference.
- Optional wording insertion into the existing `#voiceReplyText` response field. It does not submit the form.
- Issue-specific guardrails against credential requests, unsupported refunds/reversals, unverified technical claims and complaint over-promising.
- Responsive card layout for narrow screens and reduced-motion support.

## Preserved
- Existing inbound scenario choices, voice response evaluation, customer behaviour, escalation, call timeline and after-contact workflow.
- Existing first-shift and OJT event bridges.
- Existing application save and Supabase schema.

## Not included
- No generative AI/API call, microphone access, telemetry transmission, CRM mutation or automatic customer response.
- No change to native QA score or promotion calculations.
