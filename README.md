# CALLORIA — Contact Centre Career & Operations Simulator

**Build:** 0.3.0 — game-first interface and mobile interaction upgrade  
**Product:** A multi-industry contact-centre career and operations simulator. Recruitment is the entry gate; the main gameplay is actual simulated agent work, career progression and workplace operations.

## What changed in 0.3.0

- CALLORIA branding replaces the previous FLOORSHIFT working title throughout the visible application and 3D screen/signage textures.
- A darker game-oriented interface replaces the conventional white dashboard styling with a compact game navigation rail, cinematic 3D stage, operation HUD and immersive floor view.
- Desktop retains WASD/arrow movement, mouse look, sprint and E-key workstation interaction.
- Touch devices receive a virtual movement joystick, drag-to-look camera controls, run button and contextual workstation-use button.
- Mobile graphics defaults reduce pixel density, disable MSAA antialiasing and use a smaller shadow map to reduce GPU cost.
- Player progress saved by the former browser key is migrated into the CALLORIA save key on first load.
- Three.js and addons are managed through npm and bundled with Vite. Vercel is configured to run the production build and publish `dist`.

## Existing gameplay retained

- Candidate application and career-track selection.
- Recruitment aptitude, judgement, security and practical call assessment.
- Employment decision and offer acceptance.
- Inbound customer interaction simulations.
- Outbound campaign simulations.
- Simulated CRM and case records.
- Knowledge base, performance metrics and career progression.
- 3D contact-centre environment with 12 workstations and first-person navigation.

## Run and build

The repository is configured for Node.js 22.12 or later. Vercel runs `npm install` followed by `npm run build`, then serves the `dist` directory. The scripts available to a developer are `npm run dev`, `npm run check`, `npm test`, `npm run build` and `npm run preview`.

## Vercel configuration

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Vite builds the HTML entry, application modules, Three.js engine and local static assets into production bundles.

## Mobile controls

In first-person mode on a touch device:

- Use the left virtual joystick to walk. Push it up to move forward, down to reverse, and left/right to strafe.
- Drag the open 3D scene to rotate the camera.
- Hold **RUN** to move faster.
- Move close to a workstation; the **USE** control becomes enabled when a station is within interaction range.
- Use **EXIT GAME** to leave first-person mode.

On desktop, use WASD or arrow keys, Shift to run, mouse to look and E to use a nearby workstation.

## Asset requirements and limits

The current 3D world still references two rigged employee models and a reception-desk model from third-party publishers at runtime. The archive does not contain those binary GLB files. Publisher CORS, current licence terms, model skeletons, animation clips, texture quality and load performance must be verified. For a commercial release, approved assets should be stored in versioned first-party hosting and their licences retained.

The local fallback employees preserve visual occupancy if remote assets fail; they are not a substitute for final approved human models. This release improves the game shell and mobile interaction but does not add facial animation, lip-sync, seated typing animation, conversational voice, real-time call routing, live chat, email operations or multiplayer.

## Privacy and simulation boundaries

All customers, accounts, transactions, cases, calls, campaigns, salary values and performance records are simulated. No live bank, payment rail, telephone network or real customer database is connected. Browser-local state is not a production employment record system.

## Project structure

```text
CALLORIA-v0.3.0/
├── index.html
├── styles.css
├── vite.config.js
├── package.json
├── vercel.json
├── js/
│   ├── main.js
│   └── production-world.js
├── assets/
│   └── calloria-mark.svg
├── tests/
│   └── calloria.test.mjs
└── ASSET-SOURCES.md
```

## Release status

Build 0.3.0 is an upgraded, testable development build. Automated syntax, regression and production-bundle checks can verify source consistency and packaging, but a complete physical-device QA pass is still required to certify Android/iOS touch usability, GPU performance, external GLB loading, and desktop browser rendering. This is not yet a finished commercial release.
