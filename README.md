# CALLORIA v1.9 — Supervisor Intervention

Adds a supervisor GLB to the existing Three.js workplace. Escalated Customer Intelligence Lab scenarios dispatch the approved supervisor from the supervisor office zone to reception. A single supervisor handles cases sequentially; further escalations queue.

At arrival, the in-game panel lets the user record a supervisor review or return the case to the agent. The disposition is persisted to the active local Customer Intelligence Lab session and operation timeline. The case remains escalated and mandatory QA review remains open. This avoids falsely closing a critical breach merely because a supervisor avatar arrived.

## Install

1. Replace `vite.config.js` with the complete file in this package.
2. Add the included `build/`, `js/`, `styles/`, and `tests/` files to matching repository folders.
3. Keep existing `main.js`, `production-world.js`, `customer-world-integration.js`, `customer-reception-journey.js`, `package.json`, Supabase files and all source GLBs unchanged.
4. In `/asset-inspector.html`, approve `Office Female` under Supervisors. The runtime validates dimensions, skeleton, bones, triangle budget, textures and walking capability before display.

If the supervisor model is not approved or fails validation, the existing workplace remains available and the intervention panel explains the missing model requirement.

## Verification

The included Node test file contains 12 focused tests. They passed locally in the package workspace. JavaScript syntax checks passed. The full Vercel production build and browser rendering have not been run from this package workspace.
