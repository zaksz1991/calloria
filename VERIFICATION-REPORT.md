# CALLORIA v1.3.0 Verification Report

## Executed in the release workspace
- `npm run check`: passed. The JavaScript modules, including the new AI-assist client module, passed Node syntax checks.
- `npm test`: passed, **106 tests / 106 passed / 0 failed** after the v1.3.0 AI workflow and security-boundary updates.
- ZIP archive: created and checked with Python's ZIP integrity test; final result is recorded in the delivery response.

## Not verified
- Vite production build: not run because dependency installation timed out and Vite is not present in the environment.
- Deno type-check or live deployment of `supabase/functions/calloria-ai-assist/index.ts`.
- Execution of Supabase migration 003 against a live PostgreSQL/Supabase project; RLS, trigger and quota behaviour have only source-level regression coverage.
- Live OpenAI API request, billing, account-specific model availability or provider response quality.
- Browser UI, accessibility, 3D rendering, audio, Android/iOS behaviour or end-to-end interaction.
- Live tenant-isolation testing, production load testing, GitHub commit or Vercel deployment.

## Data and security boundary
AI settings and usage counts are tenant-scoped in PostgreSQL after migration 003. Tenant settings can be changed only by users with `policies:manage`, and the settings audit actor is taken from `auth.uid()` rather than a client-supplied user ID. AI request admission uses an authenticated membership check and an atomic per-organisation UTC-day quota. The Edge Function requires a configured exact origin allowlist, checks the Customer Lab source marker plus the known synthetic interaction ID/persona/issue/channel catalogue, and repeats common-identifier redaction. Those client-generated source values are not cryptographic proof that text was never edited or copied; never paste real customer or employee data into the simulator or AI workflow.

Only the request count/date are stored in `calloria_ai_usage`; transcript contents and provider output are not inserted there. The employment snapshot may store the resulting advisory analysis on the current user's browser/cloud snapshot. The provider API key is read only by the Supabase Edge Function from `OPENAI_API_KEY`. The function uses the OpenAI Responses API with `store: false`; this flag is not a guarantee of zero provider-side processing or retention. No AI result is an official QA score or employment decision.
