# CALLORIA v6.1 — Agent Career Progression, XP & Achievements

## Purpose

This is the next gameplay layer for the v6.0 Live Floor. It adds visible career progression to the player's actual simulated customer-care shifts. It does not add another back-office application and does not make banking, billing, accounting or bank statements part of the default game.

## What changes in the game

- The Live Floor now shows the player's game rank, accumulated Career XP and progress to the next rank.
- Six live shift objectives update as the player works: complete three contacts, maintain 85% QA, use approved knowledge, avoid critical compliance breaches, attend both briefings and complete both scheduled breaks.
- Eight achievement badges are available: First Contact, Five Served, Quality Standard, Customer Champion, Knowledge Seeker, Safe Handling, Floor Discipline and First-Contact Resolver.
- End-of-shift reports award XP based on completed contacts, service score, knowledge use and shift discipline.
- A critical compliance breach blocks all Career XP and performance-badge unlocks for that shift.
- Completed shifts are imported idempotently from v6.0's current and archived shift records. The same shift cannot be rewarded twice after a refresh or after starting the next shift.
- Progress profiles are separated by employee name and assigned team on that browser.
- A career reward panel shows XP, new achievements and game-rank advancement at shift close.

## Rank ladder

| Career XP | Game rank |
|---:|---|
| 0 | New Starter |
| 300 | Customer Care Associate |
| 750 | Skilled Associate |
| 1,500 | Senior Associate |
| 2,500 | Product Support Specialist |
| 3,800 | Senior Specialist |
| 5,400 | Team Lead Candidate |
| 7,200 | Leadership Ready |

These are gameplay ranks only. They are not actual job titles, HR grades or automatic promotions. Real promotions continue to require the formal performance/KPI and assessment process. XP does not change v4.9 employment or promotion records.

## Install

This is an overlay for the CALLORIA v6.0 Live Floor. The v6.0 base files must already be in the repository's `public/` folder.

Copy these five files from this package's `public/` folder into the repository's existing `public/` folder, replacing the matching v6.0 files:

- `live-floor.html`
- `live-floor.css`
- `live-floor.js`
- `live-floor-engine.js`
- `career-progression-engine.js` (new)

Keep the existing v6.0 dependencies `agent-workbench-engine.js` and `customer-journey-engine.js`. Do not remove or replace them with unrelated engine files. No Vite configuration or package changes are required.

The page remains at:

`https://calloria.vercel.app/live-floor.html`

The route is available only after the updated files are committed and a successful deployment completes.

## Storage and data boundaries

- Career data is stored in browser local storage under `calloria.career-progression.v61`.
- The Live Floor continues using its v6.0 shift record. Customer and case write-through remain local to the same browser/origin.
- Progress is separated by employee name and team; use the same name/team on later shifts to continue the same profile.
- The new engine reads completed shift summaries from the v6.0 Live Floor state. It does not read or modify the optional Billing/Finance modules.
- No external login, Supabase write, HR sync, live multiplayer, actual telephone, email or messaging service is added.
- This release still does not embed the Live Floor into the 3D office/GLB scene or main 3D navigation. It upgrades the playable shift's progression layer first.

## Verification

See `VERIFICATION.md` for focused test results and unverified deployment/browser checks.
