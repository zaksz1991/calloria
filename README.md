# FLOORSHIFT 3D — Contact Centre Career & Operations Simulator

**Build:** 0.2.0 — Professional 3D workplace vertical slice  
**Product direction:** recruitment-gated, multi-industry contact-centre career and operations simulation.

## What this build changes

Build 0.2 replaces the earlier basic 3D room study with a substantially rebuilt, navigable contact-centre environment. The 3D scene is isolated in `js/production-world.js` so its visual and interaction systems can evolve separately from recruitment, call scenarios, CRM and career logic in `js/main.js`.

### 3D workplace

- A purpose-built, real-scale corporate contact-centre floor with architectural shell, glazing, ceiling structure, room divisions, reception, meeting area and supervisor/QA suite.
- Twelve detailed agent workstations arranged in three operating pods.
- Dual displays with custom simulated CRM and queue interfaces, keyboards, mouse and cable, desk phones, headsets, CPU enclosures, drawers, acoustic dividers, ergonomic chairs, station identifiers and status lights.
- Physically based materials, authored procedural surface textures, real-time lighting, shadows, ambient occlusion-like material depth, fog and filmic tone mapping.
- First-person workplace navigation with WASD/arrow movement, mouse look, sprint, workstation proximity and E-key interaction.
- A preview camera with drag-to-orbit and scroll-to-zoom.
- Rigged high-detail human characters and an authored reception-desk asset loaded from the asset publishers listed in `ASSET-SOURCES.md`.
- A local detailed character and reception fallback path if external assets cannot be loaded.

### Career and operations foundation retained

- Candidate application and career-track selection.
- Recruitment assessment covering communication, listening, security, judgement, digital workplace skills, outbound ethics and prioritisation.
- Practical inbound-call roleplay before employment.
- Recruitment outcome and simulated employment offer; agent operations remain locked until the offer is accepted.
- Existing inbound and outbound scenario flows across multiple industries.
- Simulated CRM case records, knowledge base, performance dashboard and career progression.
- Local browser persistence for the prototype.

## How to play

1. Open the project through a static web host or local web server; do not open `index.html` directly as a `file://` URL.
2. Wait for the 3D workplace and asset status to initialise.
3. Drag the scene to orbit and use the scroll wheel to zoom.
4. Select **Enter the 3D floor** to switch to first-person mode.
5. Use **W/A/S/D** or arrow keys to move, **Shift** to move faster, and the mouse to look around. If pointer lock is unavailable, click and drag to look.
6. Approach an agent workstation until the E prompt appears, then press **E**.
7. Recruitment-gated applicants are directed to the application flow. Hired agents can open inbound, outbound, CRM or knowledge operations from the workstation panel.
8. Press **Esc** or **Exit floor** to return to the preview.

## Asset delivery and network requirements

The project references two CC0 rigged human character models and one CC0 reception-desk model. They are loaded at runtime from their publishers and are **not bundled in the ZIP** because the build environment could not retrieve the binary downloads. A network connection and publisher CORS access are therefore required for those authored models. When a request fails, local detailed mesh fallbacks are used and the scene remains playable.

Before commercial deployment, copy the approved model files into a first-party asset bucket, pin immutable versions, record licence copies and attribution requirements, and update `js/production-world.js` to use those first-party URLs. Do not make a commercial launch depend on third-party asset URLs remaining available.

See `ASSET-SOURCES.md` for model sources and licence notes.

## What is and is not production-ready

This is a **professional 3D vertical slice**, not a finished commercial release. It now demonstrates a real navigable workplace, detailed environment and workstation construction, human character loading, first-person controls and workstation interaction. The pre-existing recruitment and operations interfaces remain integrated.

The following still require engineering before the product can be called commercially production-ready:

- Vendor and pin all final 3D assets in first-party storage; replace any fallback meshes with approved production models.
- Verify the actual GLB downloads, CORS, skeletons, textures, animation clips and character scale in supported browsers.
- Add proper animation state transitions for sitting, typing, speaking, listening, walking, turning and headset use.
- Add a fully integrated operational simulation engine for real-time inbound routing, outbound dialling, hold, callback, warm transfer, after-call work and channel concurrency.
- Add microphone-based voice, speech recognition, customer audio, email and live chat.
- Add supervisor presence, QA review, queue control and role-specific KPI rules.
- Move employment profiles, activity, progression and organisation configuration from browser storage to a secure server-backed data model.
- Complete accessibility, browser, device, load, security, privacy and regression testing.

No real banking system, customer database, payment service or telephone network is connected. All customers, accounts, cases, transactions, calls, campaigns, salaries and performance records are simulated.

Organisation-specific products, procedures, charges, escalation rules, contact permissions and QA standards must be supplied and approved by the relevant organisation. The supplied banking timetable informs content coverage; it is not proof of official policy.

## Technical stack

- Three.js 0.170.0 for rendering.
- Three.js GLTFLoader, SkeletonUtils and RoundedBoxGeometry addons.
- ES modules and vanilla JavaScript for the current application shell.
- HTML and CSS for the surrounding workstation interface.
- Runtime character and furniture models documented in `ASSET-SOURCES.md`.

The renderer targets WebGL 2-capable current desktop browsers. It uses bounded pixel density and real-time shadows; final frame-rate targets still need measurement on representative devices.

## Project structure

```text
floorshift-3d-mvp/
├── index.html
├── styles.css
├── js/
│   ├── main.js
│   └── production-world.js
├── assets/
│   └── floorshift-mark.svg
├── tests/
│   └── floorshift.test.mjs
├── ASSET-SOURCES.md
├── CHANGELOG.md
├── PRODUCT-ROADMAP.md
├── README.md
├── package.json
└── vercel.json
```

## Verification

The release checks include JavaScript syntax validation and static regression tests. Those checks cannot establish that remote GLB assets load correctly, that the 3D scene looks correct on every GPU, or that the app meets commercial performance and accessibility targets. Browser-based visual and interaction testing remains a release requirement.
