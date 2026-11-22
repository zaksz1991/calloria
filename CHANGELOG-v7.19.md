# Changelog — CALLORIA v7.19

## Digital Resolution Evidence Integrity

- Adds an outcome-evidence selector to the digital after-contact form.
- Requires customer-confirmation evidence or a valid one-touch resolution for `resolved` dispositions.
- Prevents one-touch closure while a scripted customer reply is still pending.
- Prevents resolution of supervisor-risk conversations until a linked review is recorded.
- Requires customer-information-pending evidence for `pending_customer`.
- Requires a linked supervisor request for `escalated` dispositions.
- Raises factual note minimum to 20 characters.
- Persists a compact `dispositionEvidence` object onto the synthetic CRM case.
- Uses one simulated timestamp for both evidence and contact completion.
- Adds source-drift protection: the Vite transform skips the complete integration if any expected anchor is missing or duplicated.

No Supabase migration, external provider integration, QA scorecard change or salary/promotion change.
