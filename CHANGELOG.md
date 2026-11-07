# CALLORIA v1.3.1 — Email Registration Validation Hotfix

- Improved email normalisation for copy/paste and browser autofill edge cases.
- Added IDN domain conversion, plus-addressing and multi-part domain coverage.
- Replaced the vague email error with actionable format guidance.
- Preserved the Create account tab after sign-up errors.
- No Supabase migration changes. This hotfix does not alter shared database objects.

# CALLORIA v1.3.0 — AI-Assisted Customer Intelligence

## Added
- Tenant-controlled AI assistance in the Human QA workspace.
- Supabase Edge Function gateway using the OpenAI Responses API; provider credentials remain server-side.
- Two supported tenant model selections: `gpt-6-luna` and `gpt-6.1-terra`.
- Explicit per-analysis consent before a redacted synthetic transcript is transmitted.
- A dedicated AI transcript preserves both customer prompts and agent replies while keeping the existing human QA evidence transcript unchanged.
- Client- and server-side redaction for credential-like strings, long numeric identifiers and email addresses.
- AI-generated sentiment, intent, interaction summary, possible risk flags, QA observations, coaching ideas and follow-up checklist.
- Exact transcript quote verification before an AI QA evidence suggestion is displayed as verified.
- Mandatory human approval boundary: AI output never creates or changes an official human QA review, dispute, promotion score or employee decision.
- Organisation-level enable/disable setting, model selection and daily usage limit (1–5,000 requests).
- Atomic tenant daily quota enforcement in PostgreSQL.
- Usage counter stores request counts only; transcript text and provider response are not written to the AI usage table.

## Security and data limits
- AI requests require a valid Supabase user session and an active membership in the selected organisation.
- Tenant settings are readable by active members and writable only by users with organisation policy-management permission.
- The Edge Function requires a server-side `OPENAI_API_KEY`, enforces organisation settings and redaction, and does not log request bodies.
- The browser contains no provider API key and calls only the authenticated Supabase Edge Function.
- Only synthetic training transcripts are in scope. Audio is not sent.
- Provider request uses `store: false`; this is not a promise of zero provider-side processing or retention. Review provider contractual terms and data controls before enabling the feature for any non-synthetic data.
- The feature is disabled by default. It is unavailable until migration 003 and the Edge Function are deployed.

## Preserved
All recruitment, 3D workplace, voice and digital operations, workforce/briefing, promotion, CRM, organisation tenancy, employment snapshot, human QA, dispute and calibration workflows from v1.2.0 remain in the package.

## Verification boundary
The Node regression suite and syntax checks are run for this package. SQL is statically inspected by regression tests, not executed against a live Supabase database. The Deno Edge Function, live provider request, Vite production build, browser/mobile behaviour, live tenant isolation and deployment must be validated in the target project before production use.
