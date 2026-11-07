# CALLORIA v1.4.0 — Verification report

## Automated checks completed in the release workspace

- `npm test`: **124 tests passed, 0 failed**.
- `npm run check`: passed; all configured JavaScript modules passed Node syntax checks.
- ZIP integrity: validated after packaging.
- Secret scan: no Groq API key value, Supabase secret key, or `OPENAI_API_KEY` value is included in the release archive.

## What changed

- Guest-first entry: users can start the 3D simulation without registration. Account sign-in remains optional for cloud/organisation functions.
- A full-screen launch screen is the initial view. It hides the conventional topbar, sidebar and workspace content. The launch overlay hides when first-person gameplay begins. The Operations Desk remains a secondary interface and is not represented as fully converted to 3D.
- Guest progress continues to use device-local storage. This release does not automatically merge an existing guest save into a newly created cloud account.
- Lower-cost rendering profiles for touch, low-memory, low-CPU and Save-Data devices; reduced point lights/shadows, texture resolution and anisotropy; unused remote 3D loader modules are skipped on lower-cost profiles; remote staff assets deferred until gameplay and skipped on lower-cost profiles; rendering paused when the tab/scene is not visible.
- Adaptive pixel ratio uses a smoothed main-thread render-submission-time estimate. This is not a GPU timer or an on-device benchmark result.
- Anonymous game sessions begin when the visitor enters gameplay or opens the Operations Desk, not merely when the launch screen loads.
- Live player, total browser-profile and session counters are returned by Supabase functions. Unavailable statistics display dashes.
- A launch-screen sponsorship slot supports approved active campaign creatives and records impression/click events. There is no advertiser self-service portal, billing or automated campaign approval in this release.
- The AI QA Edge Function now calls Groq Chat Completions and reads `GROQ_API_KEY` only from Supabase Edge Function Secrets. Guest play does not require Groq. AI analysis still requires a signed-in organisation member, enabled AI settings and synthetic Customer Lab data.

## Database change

Apply only `supabase/migrations/202611070004_calloria_game_platform.sql` after the already-applied migrations 001–003. This adds CALLORIA-prefixed game visitor/session/sponsor tables and RPCs and updates the model constraint on `calloria_ai_settings`. It does not alter RuffNeck Prospector-specific tables or Supabase Auth triggers.

The generic `profiles` and `organization_*` objects and Auth profile trigger created by earlier migrations 001–003 are not retrofitted by migration 004. The earlier shared-schema review and isolation follow-up remain outstanding; this release does not claim that all earlier generic objects have been namespaced.

## Not verified

- Vite production build: attempted, but the workspace has no installed Vite executable (`vite: not found`). `npm install` timed out. No production build success is claimed.
- Deno type-check or live Supabase Edge Function deployment.
- Live execution of migration 004 against the shared RuffNeck Prospector Supabase project.
- Live Groq request or provider quota/billing behaviour. The user has not yet added `GROQ_API_KEY` to Supabase Edge Function Secrets.
- Live registration, authentication, tenant isolation or regression tests against RuffNeck Prospector.
- Real-browser gameplay, Android/iOS testing, GPU profiling, representative low-end device FPS or measured before/after performance. The optimisations are code changes, not a verified speed benchmark.
- Live sponsor campaign approval, impression billing, click validation or advertiser payments.
- GitHub update or Vercel deployment.

## Statistics and privacy limits

- Live Players means distinct anonymous browser profiles with a heartbeat in the preceding five minutes.
- Total Players means distinct anonymous browser-profile IDs recorded by CALLORIA, not verified unique human beings.
- Game Sessions counts recorded page/game sessions; clearing browser storage can create a new anonymous profile. Public telemetry can be manipulated by automated clients, so treat these values as operational estimates rather than audited audience measurements.
- The client stores a random visitor ID in local storage and a random session ID for the current page session. The server stores a peppered SHA-256 visitor hash, not the raw visitor ID. No IP address or user-agent is written by the telemetry function.

## Secret handling

- `GROQ_API_KEY` is not a Vercel variable, `VITE_` variable, browser value, source-code constant or repository file.
- Add it in the existing Supabase project under **Edge Functions → Secrets / Edge Function Secrets**. The current Supabase project can serve multiple Edge Functions; only CALLORIA's AI function reads this Groq secret.
- Reusing the same Groq key value across the other website and CALLORIA leaves the other website's configuration unchanged, but the sites share the same Groq account/key usage quota and billing.
