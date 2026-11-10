# CALLORIA v3.5 — First Working Shift

**Patch type:** repository overlay patch  
**Target repository:** `zaksz1991/calloria`  
**Target branch:** `main`  
**Target deployment:** `https://calloria.vercel.app`  
**Baseline inspected:** public `main` source on 10 November 2026, including the v3.3 Vite plugin chain.

## Purpose

This patch addresses the most visible problems in the supplied Android gameplay screenshots and makes the first-shift route lead into actual contact-centre work.

It does not replace CALLORIA with a training quiz. Recruitment remains the employment entry gate; the core game remains shift work, inbound/outbound customer operations, simulated enterprise applications, supervisor/QA outcomes and career progression.

## Included files

| Repository path | Change |
|---|---|
| `vite.config.js` | Complete replacement preserving the existing HTML entry points and current plugin order, with the v3.5 plugin appended after existing source transforms. |
| `build/calloria-first-working-shift-v3-5-plugin.mjs` | New plugin for Draco + Meshopt staff model decoding, player-model pose checks, first-person touch mode, shift/briefing gate, direct route into inbound work and compact mobile mission guidance. |
| `build/calloria-third-person-player-plugin.mjs` | Complete replacement that reports intentional first-person touch mode and retains the existing desktop avatar integration. |
| `tests/calloria-first-working-shift-v3-5.test.mjs` | Ten focused regression tests for the new transforms and expected current-source anchors. |

## Main behaviour changes

1. Adds the Three.js Draco decoder to the existing staff GLTF loader, while retaining the already-installed Meshopt decoder. The production build copies the three decoder runtime files into `dist/draco/` and serves them from `/draco/` during development.
2. Stops displaying the third-person player GLB on touch devices. Mobile remains in the existing first-person controller view so the avatar does not obscure the workstations or show the rejected pose.
3. On desktop, rejects the player GLB unless it has a skinned mesh, a usable bone count, and named idle and walking clips. Rejected candidates are reported in the asset status tooltip.
4. Requires an attendance record for the current simulated day before a shift can start. It recognises the current day's 07:30 morning or 14:00 afternoon briefing.
5. Routes a successful shift start directly to inbound operations rather than the generic overview screen.
6. Adds an `OPEN WORK DESK` action in the immersive 3D HUD. It reuses CALLORIA's existing recruitment gate, Workforce view and inbound operation flow; it does not create a parallel fake call simulator.
7. Compresses the oversized first-shift tutorial card on mobile and hides its redundant controls paragraph.

## What this patch does not claim

- It does not contain new high-detail human GLB models or replace all low-poly office props.
- It does not guarantee that currently referenced remote staff assets are reachable, licensed for commercial distribution, or compatible. Draco decoding only removes one possible loading incompatibility.
- It does not create a new voice provider, real telephone service, speech AI, multiplayer or live CRM integration.
- It does not make the existing simulated inbound queue or CRM a real banking system.
- It does not claim a successful full application build, GitHub commit, Vercel deployment, live browser session or Android device test.

Install this patch **instead of the earlier v3.4 draft**. Do not layer v3.4 first; v3.5 is built against the current post-Meshopt and post-static-staff source transformations and includes the complete updated Vite configuration.

See `INSTALL-GITHUB.md` and `VERIFICATION.md` before applying it.
