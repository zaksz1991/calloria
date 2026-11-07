# CALLORIA v1.4.0 — Supabase and Groq setup

## Shared Supabase project

Use the existing `ruffneck-prospector` Supabase project. Keep its Site URL set to the existing RuffNeck Prospector website. The allowed redirect list may include both:

- `https://ruffneck-prospector.vercel.app/**`
- `https://calloria.vercel.app/**`

CALLORIA continues to use the configured `VITE_SUPABASE_URL` and publishable/anon key in Vercel. Do not add a Supabase service-role/secret key to a Vite environment variable.

## Migrations already applied

The user has already applied migrations 001, 002 and 003. Do not apply them again.

Apply only `supabase/migrations/202611070004_calloria_game_platform.sql` once. It adds CALLORIA-prefixed game analytics and sponsor inventory. It updates the CALLORIA AI model constraint to support Groq model IDs. It does not edit RuffNeck Prospector's tables or Auth triggers.

## Add the Groq API key here — not in Vercel

In the existing Supabase project dashboard:

1. Open **Edge Functions**.
2. Open **Secrets** / **Edge Function Secrets**.
3. Add `GROQ_API_KEY` and paste the key directly into the Value field.
4. Add or update `CALLORIA_ALLOWED_ORIGINS` to include `https://calloria.vercel.app` exactly.
5. Save the secrets.

Do not send the key through ChatGPT, add it to Vercel, use a `VITE_` prefix, put it in `.env.example`, or commit it to GitHub.

The existing Groq key on another website can remain configured there. If you use the same key value for CALLORIA, the two sites share that Groq account/key's usage limits and billing, but adding the key to this Supabase project does not alter the other website's deployment variables.

## AI Edge Function

Deploy/update the function named `calloria-ai-assist` in **Edge Functions** using the source file `supabase/functions/calloria-ai-assist/index.ts` from this release. Keep JWT verification enabled. The function reads `GROQ_API_KEY` only on the server and calls the Groq OpenAI-compatible Chat Completions endpoint.

Supported models:
- `openai/gpt-oss-20b` — default, lower-latency practice analysis.
- `openai/gpt-oss-120b` — deeper analysis.

The current function enforces authenticated user validation, active organisation membership, organisation settings, a daily request quota, transcript redaction, synthetic Customer Lab data restrictions, origin allowlisting and human approval. The model output remains advisory and does not automatically become an official QA score or employment decision.

## Game telemetry Edge Function

Deploy `calloria-game-telemetry` from `supabase/functions/calloria-game-telemetry/index.ts` through the Supabase Dashboard. This anonymous endpoint is used for visitor/session metrics and sponsor events. JWT verification is disabled specifically for this function; the code requires an exact allowed browser origin and uses server-injected Supabase server credentials. Never expose those credentials to the client.

## Limits of public counters

- Live Players: distinct anonymous browser profiles with a heartbeat within the last five minutes.
- Total Players: cumulative distinct anonymous browser-profile IDs, not verified unique human beings.
- Game Sessions: distinct recorded browser sessions.
- Daily Players: distinct anonymous browser profiles that started a session today.

Counts can be reset by clearing browser storage or changed by bots/automation. They are operational estimates, not audited unique-person counts. They display dashes when the telemetry service is unavailable; the application does not invent values.

## Sponsor campaigns

Campaigns must be approved before activation. The current v1.4 launch slot displays only active `game_launch` campaigns whose start/end window is valid. Campaign authoring/admin UI and advertiser billing are not included yet. Approve content manually in the database until that admin workspace is built.
