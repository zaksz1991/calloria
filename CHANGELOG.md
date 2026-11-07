# CALLORIA v1.4.0

## Game-first experience and guest access
- Replaced the initial website/dashboard-first presentation with a full-screen 3D game launch screen.
- Added immediate guest play. Supabase sign-in, account creation and organisation workspaces remain optional.
- Added an optional Operations Desk route and a persistent return-to-3D-game action.
- Clarified that guest progress is stored locally on the current browser/device.

## Rendering and loading performance
- Reduced procedural texture-generation work during world startup.
- Added a device capability profile using touch support, available memory, CPU cores and Save-Data hints.
- Lower-end/touch profiles use lower pixel-ratio caps, no real-time shadow maps, fewer accent lights and local staff models.
- High-detail third-party staff assets are requested only when the player enters the 3D floor; mobile/low-end profiles skip those downloads.
- Removed the duplicate remote reception GLB load; the local reception model remains.
- Paused rendering while the page is hidden or the world host is outside the viewport.
- Throttled menu preview to 14–20 FPS and gameplay to 30–40 FPS, depending on device profile.

## Live game stats and sponsorship inventory
- Added anonymous visitor/session telemetry through a Supabase Edge Function.
- Added live player, cumulative anonymous browser-profile, session and daily browser-profile metrics.
- Added an approved sponsor campaign slot on the game launch screen with impression/click event recording.
- Public counts are blank/unavailable until migration 004 and the telemetry Edge Function are deployed. No sample/fabricated counts are shown.
- “Total players” represents unique anonymous browser profiles, not verified unique human beings. Clearing browser storage or changing devices may create another profile.

## Groq provider
- Reconfigured the existing server-side CALLORIA AI-assist function to use Groq's OpenAI-compatible Chat Completions endpoint.
- Supported model IDs: `openai/gpt-oss-20b` and `openai/gpt-oss-120b`.
- Provider credentials are read only from Supabase Edge Function Secrets as `GROQ_API_KEY`; no provider secret is included in Vercel client variables, browser code, `.env.example` or this archive.
- Existing transcript redaction, tenant membership checks, usage quota and human approval requirements remain.

## Database changes
- Added additive migration `202611070004_calloria_game_platform.sql` for game visitor/session telemetry and sponsor campaign/event storage.
- Migration 004 changes only the CALLORIA AI settings model constraint and adds `calloria_`-prefixed game tables/functions. It does not alter Prospector tables or Supabase Auth triggers.
- Do not rerun migrations 001–003; they have already been applied in the shared project.

## Verification limits
- Automated tests and JavaScript syntax checks are listed in `VERIFICATION-REPORT.md`.
- No production build, live Supabase function deployment, live Groq inference request, browser/device profiling or Vercel deployment is claimed unless separately recorded there.

- Added adaptive pixel-ratio control based on a smoothed main-thread render-submission-time estimate; this is not a GPU timer.
- Reduced local ceiling point lights for low-cost device profiles.
- Hid the game launch overlay after entering first-person gameplay.
- Lowered procedural texture resolution/anisotropy on low-cost profiles and skipped GLTF/SkeletonUtils imports when remote character assets are disabled.
