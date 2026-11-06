# Changelog

## 0.4.0 — Contact-centre operations engine

- Extracted contact queue, lifecycle transitions, priority routing, callback scheduling and outbound suppression into a dedicated operations engine module.
- Added prioritised inbound queue and routing group presentation.
- Added contact lifecycle recording for queue, offer, connect, hold, resume, transfer, wrap-up, callback, completion and escalation.
- Added active-call hold/resume, specialist transfer, supervisor assistance and return-to-queue controls.
- Added after-contact work with disposition validation, factual case notes and mandatory completion before agent continuation.
- Added inbound callbacks with due-time controls and callback re-queueing.
- Added outbound dial-attempt IDs, wrap-up dispositions, customer opt-out suppression and scheduled callback continuation.
- Added a supervisor desk for assistance requests and escalated case review.
- Expanded CRM with disposition, case notes, owner and interaction event history.
- Added queue wait, service-level snapshot and after-contact work indicators to performance reporting.
- Added Queue and Supervisor destinations to the game menu and 3D workstation interactions.
- Added nine operations-engine and integration regression tests; total automated regression tests now 18.
- Preserved the v0.3.0 game-first shell, mobile controls, recruitment, employment, scenarios, workstation, CRM, knowledge base and career systems.

## 0.3.0 — CALLORIA game-first and mobile interaction upgrade

- Rebranded visible application, browser metadata, workplace UI textures, reception signage, project metadata and documentation to CALLORIA.
- Preserved existing applicant and employee progress by migrating the former `floorshift3d.save.v1` browser save key to `calloria.save.v1`.
- Replaced the conventional dashboard appearance with a dark game HUD, compact navigation rail, cinematic 3D stage and immersive game overlay.
- Added mobile touch movement joystick, drag-to-look camera control, run button and nearby workstation interaction button.
- Added coarse-pointer graphics settings with reduced device pixel ratio, antialiasing and shadow map size.
- Migrated Three.js and its addons to npm-managed imports.
- Added Vite production build scripts and Vercel build/output configuration.
- Added brand, touch-control, source-structure and build regression tests.

## 0.2.0 — Professional 3D workplace vertical slice

- Rebuilt the earlier room study into a purpose-built contact-centre environment.
- Added 12 detailed workstations and supporting office zones.
- Added first-person navigation and workstation proximity interactions.
- Added runtime GLTF loading for rigged employees and a reception asset, with local fallbacks.
- Preserved recruitment, inbound/outbound scenario experiences, CRM, knowledge, performance and career views.

## 0.1.0 — Initial functional prototype

- Established recruitment application and assessment flow.
- Added employment offer, initial inbound/outbound call scenarios, CRM, knowledge base, performance and career foundations.
- Added the first contact-centre scene study.
