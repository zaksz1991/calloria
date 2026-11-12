# CALLORIA v6.2 — 3D Workplace & GLB Workstation Bridge

## Purpose

v6.2 adds a navigable 3D contact-centre floor and connects its workstations to the existing v6.1 playable Live Floor. It is a gameplay bridge, not another back-office subsystem. Banking, billing and bank statements are not part of the default workplace.

## What is included

- New `/office-floor.html` 3D workplace page.
- Four walk-up workstations: Customer Care, Digital Support, Product Support and Service Recovery.
- First-person movement with WASD, mouse-look and pointer lock; mobile touch movement and look-drag are included.
- Workstation interaction using `E` or the on-screen `USE` control.
- Entering an operational station opens the existing `/live-floor.html` customer shift with the station's team preselected.
- Live Floor has a `3D WORKPLACE` return link.
- Office HUD reads the existing v6.0 shift record and v6.1 career profile from the same browser origin. It does not create or rewrite those records.
- Local asset inspection for desk, computer, agent and supervisor GLBs.
- GLB candidate paths are tried in order and the exact successful/missing paths appear in the Asset Check panel.
- A workstation is disabled unless both its desk and computer GLB models load. Character models are optional for station activation, but missing characters are not replaced with primitive human placeholders.
- Loaded character models are cloned with Three.js SkeletonUtils; an available idle animation is used when the GLB includes animations.
- Performance guardrails: pinned Three.js 0.170.0, capped pixel ratio, no real-time shadows, one shared load per model role, and no additional 3D dependency in `package.json`.

## Install

This is an overlay for CALLORIA v6.1. The existing v6.1 Live Floor dependencies must already be in `public/`:

- `agent-workbench-engine.js`
- `customer-journey-engine.js`
- `live-floor-engine.js`
- `career-progression-engine.js`

Copy these seven files from this package's `public/` folder into the repository's existing `public/` folder, replacing only the matching files:

- `office-floor.html` (new)
- `office-floor.css` (new)
- `office-floor.js` (new)
- `office-floor-engine.js` (new)
- `live-floor.html` (updated with a return link and v6.2 label)
- `live-floor.css` (updated with return-link styling)
- `live-floor.js` (updated to preselect the workstation team on arrival)

Do not remove the existing v6.1 engine dependencies or GLB model directory. No Vite config or `package.json` change is required because these files are served from the existing Vite `public/` directory.

## Routes

- 3D workplace: `https://calloria.vercel.app/office-floor.html`
- Customer shift: `https://calloria.vercel.app/live-floor.html`

These routes are available only after the updated files are committed and the deployment succeeds.

## Asset path handling

The page searches the current `public/assets/models/` tree. It tries several likely filenames under the known model folders for:

- `office/desks/office_desk`
- `office/equipment/office_computer`
- `characters/agents/female-agent` and `characters/agents/male-agent`, plus their alternate folder layout
- `supervisors/office_female`

The original GLB folder structure was not available in this patch workspace, so this package cannot assert that any particular model filename exists in the user's live repository. The in-page Asset Check reports the result after the page loads. If a path differs from the existing asset tree, add the actual filename to the relevant role's candidate list in `office-floor-engine.js`; do not rename or duplicate large GLB files unnecessarily.

Desk and computer assets are required to enable workstation entry. Agent and supervisor models are displayed when found. Missing character models remain visibly reported; no oversized geometry substitute is rendered.

## Technical boundaries

- The 3D workplace uses Three.js 0.170.0 from a pinned jsDelivr CDN import map. A network connection to that CDN is required to start the renderer. GLB files remain local to CALLORIA.
- This is a first-person 3D workplace prototype. It does not add collision-aware furniture navigation, multiplayer, real-time employee presence, audio, voice calling or live customer messaging.
- Workstation entry opens the existing 2D playable shift. This package does not embed the entire three-step customer conversation UI into the 3D scene.
- Shift and career HUD values are read from browser localStorage on the same origin. They are not shared between devices or employee accounts.
- The office page does not modify Supabase, Groq, bank, billing or finance settings.

## Verification

See `VERIFICATION.md`. Focused engine tests and syntax checks are run in this patch workspace. A full repository Vite build, production Vercel deployment and browser test against the user's actual GLB asset directory are not part of this verification.
