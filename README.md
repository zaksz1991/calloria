# CALLORIA v1.4.0

**CALLORIA — The Contact Centre Career Simulator**

A browser-based career and contact-centre operations simulation. This release changes the starting experience to a game-first, full-screen 3D launch flow and permits guest play without account registration.

## Player experience

- Play immediately as a guest. No registration or login is required to enter the simulation.
- Guest progress is stored locally on the current browser/device.
- Optional Supabase accounts support organisation workspaces and cloud employment saves.
- Full-screen 3D game launch screen; the Operations Desk is a secondary management/workstation route.
- Desktop keyboard/mouse and mobile touch controls remain supported.

## Rendering performance work

- Device capability profile adjusts render pixel ratio, shadow maps, auxiliary lighting, texture dimensions and texture anisotropy; lower-cost profiles also skip unnecessary remote character-loader modules.
- Lower-end/touch profiles avoid external character downloads and use the local staff models.
- Desktop GLB staff downloads are deferred until the player enters the floor.
- Duplicate remote reception asset loading was removed.
- Preview render is throttled to 14–20 FPS; active gameplay to 30–40 FPS based on device profile.
- The renderer pauses when the tab is hidden or the world panel is outside the viewport.
- Procedural texture startup work was reduced.

These are code-level performance measures. No real device benchmark or browser profiling is claimed in this build; measure on representative low-end Android devices and desktops before treating a target FPS as achieved.

## Public game statistics and sponsors

The launch screen can display live players, total anonymous browser profiles, game sessions and a game-launch sponsor creative. Numbers are sourced from server-side events and remain unavailable until Supabase migration 004 and `calloria-game-telemetry` are deployed.

`Total Players` counts distinct anonymous browser profiles, not verified unique people. Clearing browser storage, using another browser/device or scripted traffic can alter the count. No hardcoded/sample counters are used.

Sponsor campaigns require manual approval and must be active, within their schedule, and assigned the `game_launch` placement. This release includes the launch-screen placement and impression/click event recording, not a full advertiser self-service/billing dashboard.

## AI provider

CALLORIA's optional organisation AI QA assistant uses **Groq**. The API key is read from the Supabase Edge Function secret `GROQ_API_KEY`, never from Vercel browser variables or client code. Supported model IDs are `openai/gpt-oss-20b` and `openai/gpt-oss-120b`.

Do not place a Groq key in this repository or paste it into ChatGPT. Add it in the existing Supabase project under **Edge Functions → Secrets**. Reusing the same Groq key across separate sites means their API usage draws from the same Groq account/key quota and billing.

## Shared Supabase project

This build assumes the existing `ruffneck-prospector` Supabase project. Keep the existing Prospector Site URL. Do not rerun migrations 001–003; the user has already applied them. Apply only `202611070004_calloria_game_platform.sql` once, then deploy the two Edge Functions using the Supabase Dashboard.

See `SUPABASE-SETUP.md` and `DEPLOYMENT-GUIDE.md` before deployment.

## Known limits

This release is an evolving simulation platform, not a finished commercial product. Physical-device QA has not yet been completed.

- The new launch menu does not replace every operational workflow with 3D interaction. Workstation forms and some career/management workflows still open in the Operations Desk.
- External staff GLB models are fetched from their remote asset hosts only on desktop gameplay entry; availability and network time vary. Lower-end/mobile profiles use locally generated characters.
- A low pixel-ratio cap, reduced shadow work and render throttling trade some visual fidelity for performance on low-end devices.
- Sponsor authoring, campaign invoicing, payment reconciliation, in-world billboard ad rendering and self-service advertiser analytics are future work.
- Live metrics are anonymous browser-profile estimates and can be affected by storage resets and bots.
- Groq has not been tested against the live user's API account in this environment.
- The production Vite build, live database migration, Edge Function deployments, live Groq request, device/browser profiling and Vercel deployment are not claimed unless the verification report explicitly says otherwise.
