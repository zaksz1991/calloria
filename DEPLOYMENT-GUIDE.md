# CALLORIA v1.4.0 deployment guide

## Existing project layout

- Keep the existing Vercel project `calloria` and repository `zaksz1991/calloria`.
- Keep the existing Supabase project used by RuffNeck Prospector. CALLORIA uses the same project and must not change Prospector's Site URL.
- Keep the current Vercel variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and, if retained for compatibility, `VITE_SUPABASE_ANON_KEY`.
- These variables are browser-public Supabase project URL/key values. Never put a service-role key or Supabase secret key into a `VITE_` variable.

## Vercel

1. Upload the complete v1.4.0 source to the existing `main` branch of `zaksz1991/calloria` using the user's normal GitHub GUI workflow.
2. Let the existing Vercel project build the updated branch.
3. Confirm the deployed start screen reports `CALLORIA · BUILD 1.4.0` in the application metadata/version details. The visible launch screen is full-screen; the operations desk remains a secondary route.
4. Vercel environment changes require a new deployment. No Groq key belongs in Vercel.

## Supabase database

Migrations 001–003 have already been applied in the shared Supabase project. Do not run them again.

Apply only this new migration, once, in Supabase SQL Editor:

`supabase/migrations/202611070004_calloria_game_platform.sql`

Migration 004 adds CALLORIA-prefixed telemetry/sponsor tables and RPCs, and changes only `calloria_ai_settings.model` to Groq-supported model IDs. It does not alter Prospector's tables or Supabase Auth triggers. Keep a database backup/restore point before any schema maintenance.

## Groq API key — exact place to add it

1. Open the existing Supabase project `ruffneck-prospector`.
2. In the project sidebar, open **Edge Functions**.
3. Open **Secrets** (sometimes shown as **Edge Function Secrets**).
4. Add a secret:
   - Key: `GROQ_API_KEY`
   - Value: the Groq API key held in the user's Groq account. Paste it directly into the Supabase secret field; do not paste it into ChatGPT, the repository, `.env.example`, Vercel, browser storage or source files.
5. Add/confirm another secret:
   - Key: `CALLORIA_ALLOWED_ORIGINS`
   - Value: `https://calloria.vercel.app`
   - If other allowed CALLORIA preview origins are used, add those exact origins as comma-separated values. Do not add broad wildcards.
6. Click Save.

`GROQ_API_KEY` is a project-level Edge Function secret. It is available to Edge Functions in this Supabase project, but is not exposed to the browser. Only server code that explicitly reads `Deno.env.get('GROQ_API_KEY')` uses it. If the same Groq key value is also used by another website, both sites draw from the same Groq account/key quota and billing. Adding it to Supabase does not edit that other website's Vercel environment.

## Deploy the Edge Functions through the Supabase Dashboard

The Supabase Dashboard supports Edge Function creation and deployment using **Deploy a new function → Via Editor**, and existing functions can be edited and redeployed from their details page.

### AI assist function

- Function name: `calloria-ai-assist`
- Source: `supabase/functions/calloria-ai-assist/index.ts`
- Keep JWT verification enabled. `supabase/config.toml` records `verify_jwt = true`.
- Deploy the function after the secret is saved.

### Public game telemetry function

- Function name: `calloria-game-telemetry`
- Source: `supabase/functions/calloria-game-telemetry/index.ts`
- It validates the exact browser Origin against `CALLORIA_ALLOWED_ORIGINS` and uses server-injected Supabase secret credentials. No user session is required for anonymous game counters.
- JWT verification is intentionally disabled for this public telemetry endpoint; do not disable origin validation or publish a Supabase service key.
- Deploy this function after migration 004 and the secret `CALLORIA_ALLOWED_ORIGINS` are configured.

## Sponsor campaigns

The launch screen only displays campaigns with status `active`, placement `game_launch`, and a current start/end window. New campaigns default to `pending`; an authorised database administrator must vet and approve the advertiser/creative before changing status to `active`. Image and destination URLs must use HTTPS. The launch-screen placement is implemented; an advertiser self-service portal, invoicing, campaign billing, in-world billboards and sponsored scenarios are future work.

## Guest/account behaviour

- Visitors can start the 3D game without registering or signing in.
- Guest simulation progress is stored in the browser's local storage on that device.
- Signing in is optional and is needed for organisation workspaces and cloud employment saves.
- Do not assume local guest progress automatically transfers to an account.

## Checks after deployment

- Visit `https://calloria.vercel.app` in a private/incognito browser and confirm the game launch screen appears without a registration prompt.
- Start gameplay, exit and return to the game menu.
- Test keyboard/mouse and touch controls.
- Check that live statistics display real values only after migration 004 and the telemetry function are deployed; otherwise the interface should show unavailable dashes.
- Confirm the other site sharing the Supabase project still signs in and its existing Prospector workspace/data remain accessible.
- Use a synthetic Customer Lab interaction to test Groq only after an authenticated organisation and its AI settings are configured.
