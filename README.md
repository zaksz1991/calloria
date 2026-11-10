# CALLORIA v3.7.0 — Cross-industry On-the-Job Onboarding & GLB Activation

This is a targeted build-plugin and runtime upgrade prepared against `zaksz1991/calloria` commit `96649f9` on `main`.

## Product direction retained

CALLORIA remains a commercial-grade, multi-industry contact-centre career and operations simulator. Recruitment and assessment are the entry gate. The main game is employment, on-the-job development, customer work, operational performance and career progression. It is not a bank-only call-centre game and is not being converted into a training-only product.

## What this patch changes

### Employee onboarding after hiring

The OJT programme begins only after a candidate accepts an employment offer. It sequences:

1. Organisation/product/service knowledge for the selected industry.
2. CRM and interaction-logging practice.
3. A five-stage shadowing session following an experienced agent from queue offer and call acceptance through greeting, investigation, case action and wrap-up.
4. Supervised simulated customer practice.
5. Trainer sign-off before the employee receives an operating desk and can start live simulated KPI-bearing work.

A new applicant defaults to **General Customer Experience**. Banking remains one selectable specialist track among technical support, sales/retention and the other industry packs. OJT also has an explicit industry selector for banking, telecoms, retail, utilities, logistics, travel, insurance, non-clinical healthcare administration, technology/SaaS support and public-service information.

The training examples are simulations and are labelled as such; they are not represented as live calls or scored operational contacts. Existing profiles with recorded work/shift history are grandfathered rather than forced through new-hire onboarding.

### 3D worker and GLB activation

- Replaces the oversized third-person player-avatar module with a first-person-only adapter. First-person movement/camera controls remain owned by the existing 3D world. This stops the unverified player body from filling the camera view.
- Adds Three.js `DRACOLoader` beside the existing Meshopt decoder to the staff, office and shared asset-catalogue GLTF loader paths.
- Corrects staff required-extension validation so a model is not rejected merely because it uses Draco when the decoder is now configured.
- Adds two stationary staff targets on low-tier devices, where the current world had no stationary candidates for the staff GLB integration. Standing staff may use the existing static-GLB compatibility path; seated staff still require a valid seated animation/pose path.
- Enables selected workstation, computer, headset and reception GLBs on low-tier devices, while keeping the existing higher-tier layout choices.
- Copies the installed Three.js Draco decoder runtime into `dist/draco/` during Vite production builds and serves it during development.
- Reports staff/office GLB placement counts and rejection details through the existing asset-status display.
- Emits build warnings for required model files missing from `public/assets/models`; it never fabricates replacement character or furniture binaries.

### Mobile HUD

The existing oversized mission/tutorial card is constrained to a compact mobile-friendly panel. A small direct workplace-desk action remains available while exploring the 3D floor; desk access and operational shift rules remain gated by OJT sign-off and briefing attendance.

## Files in this patch

- `vite.config.js` — full config replacement based on commit `96649f9`; all existing page inputs and preceding plugins are retained. The brittle v3.5 transform registration is replaced by v3.7.
- `build/calloria-ojt-glb-activation-plugin.mjs` — new Vite integration and decoder-copy plugin.
- `build/calloria-ojt-runtime.js` — new OJT workflow and employee gating runtime.
- `tests/calloria-v37-onboarding-glb.test.mjs` — focused regression tests.

## Asset note

The six principal GLB files referenced by this integration are already present as binary paths in the inspected `96649f9` repository snapshot. This patch does **not** contain duplicate copies of those large binaries. The build checks those exact first-party paths and the browser asset-status display reports runtime failures. A successful build alone does not prove that a model passed runtime validation or rendered correctly; confirm `GLB STAFF` and `OFFICE GLB OBJECTS` counts in the actual browser.

## Installation and verification limits

See `INSTALL-GITHUB.md` and `VERIFICATION.md`. This patch has not been pushed to GitHub or deployed to Vercel. The complete repository test suite, production build, and device-level visual checks have not been run in this patch-preparation environment.
