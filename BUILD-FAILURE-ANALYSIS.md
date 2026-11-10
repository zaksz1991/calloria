# CALLORIA v3.7.2 — Build failure analysis

## Verified failure

Vercel built commit `aa25c54` and failed in `build/calloria-ojt-glb-activation-plugin.mjs` while transforming `js/glb-office-world-integration.js`:

`expected one device-tier workstation asset plan anchor; found 0`

## Root cause

The build registers `calloriaGLBWorldPlugin()` before the OJT plugin. The GLB-first plugin uses `enforce: "pre"` and rewrites the original office workstation plan from the smaller plan to an expanded v2.9 coverage plan:

- Low tier: desks/computers at stations 9 and 10.
- Balanced tier: desks/computers at stations 8–11.
- High tier: desks/computers at stations 4–11.
- Headsets: station 10 on low tier; selected workstation stations on balanced/high tiers.

The later OJT plugin uses `enforce: "post"` but still requires the original literal `[10] / [8,9,10,11] / [9,10]` and empty low-tier headset strings. The earlier plugin has already replaced those strings, so the later transform aborts the build. This is a plugin-order compatibility defect, not a missing package.

## Repair

`transformOffice()` now checks that the upstream plan has the expected structural shape, while accepting both the original plan and the expanded v2.9 plan. It only adds Three.js `DRACOLoader` to the office GLTFLoader. It no longer rewrites or overwrites the upstream station-selection policy. Low-tier reception remains omitted by design to protect mobile performance; desk/computer GLBs and one headset still have low-tier placements.

Only these repository files are replaced:

- `build/calloria-ojt-glb-activation-plugin.mjs`
- `tests/calloria-v37-onboarding-glb.test.mjs`

No Vite configuration, package file, application source, GLB asset or OJT runtime file is changed.
