# CALLORIA v1.3.1 Verification Report

## Executed in the release workspace
- `npm run check`: passed. All JavaScript modules passed Node syntax checks.
- `npm test`: passed, **108 tests / 108 passed / 0 failed**. This includes email input normalisation for plus-addresses, multi-part domains, internationalised domains, full-width punctuation and invisible copy/paste characters.
- ZIP archive: validated with the ZIP integrity test.

## v1.3.1 change scope
- Client-side email normalisation and validation only.
- The sign-up form provides a clearer validation message and stays on the Create account tab when registration fails.
- No SQL migration, Edge Function, provider credential or shared Supabase object was changed by this hotfix. Do not rerun migrations 001, 002 or 003 for v1.3.1.

## Not verified
- Vite production build: not run because dependencies are not installed in this release workspace.
- Live Supabase account creation, email confirmation or password reset.
- Live shared-project tenant isolation or effects on RuffNeck Prospector.
- Browser/device rendering, Android/iOS behaviour, or end-to-end production sign-up.
- GitHub commit, Vercel deployment or live deployment verification.

## Data and security boundary
AI settings and usage counts are tenant-scoped in PostgreSQL after migration 003. Tenant settings can be changed only by users with `policies:manage`, and the settings audit actor is taken from `auth.uid()` rather than a client-supplied user ID. AI request admission uses an authenticated membership check and an atomic per-organisation UTC-day quota. The Edge Function requires a configured exact origin allowlist, checks the Customer Lab source marker plus the known synthetic interaction ID/persona/issue/channel catalogue, and repeats common-identifier redaction. Those client-generated source values are not cryptographic proof that text was never edited or copied; never paste real customer or employee data into the simulator or AI workflow.

Only the request count/date are stored in `calloria_ai_usage`; transcript contents and provider output are not inserted there. The employment snapshot may store the resulting advisory analysis on the current user's browser/cloud snapshot. The provider API key is read only by the Supabase Edge Function from `OPENAI_API_KEY`. The function uses the OpenAI Responses API with `store: false`; this flag is not a guarantee of zero provider-side processing or retention. No AI result is an official QA score or employment decision.
