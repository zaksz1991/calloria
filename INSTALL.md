# CALLORIA v2.9 — GLB workstation coverage expansion

## What this changes

This is a focused update to the existing `calloriaGLBWorldPlugin()` transform. It uses the current Vite registration already present in `vite.config.js`; it does not add a second plugin or change `vite.config.js`.

The office GLB layer currently places only one desk on low-tier devices, two on balanced devices, and four on high-tier devices. It also places no headset on low-tier devices. v2.9 expands actual GLB coverage as follows:

| Device tier | GLB desk/computer stations | Headsets | Reception desk |
|---|---:|---:|---|
| Low | 2 (stations 10–11) | 1 (station 11) | No |
| Balanced | 4 (stations 9–12) | 4 | Yes |
| High | 8 (stations 5–12) | 8 | Yes |

The existing workstation GLBs are loaded once per asset and cloned into the planned station positions. The code retains device-tier limits, existing asset validation, fallback geometry for unselected stations, Meshopt setup and disposal.

## Install

1. Extract this ZIP.
2. Merge the included `build/` and `tests/` folders into the repository.
3. Replace `build/calloria-glb-world-plugin.js` with the included complete file.
4. Keep `vite.config.js` unchanged. It already registers `calloriaGLBWorldPlugin()`.
5. Keep `main.js`, `production-world.js`, `glb-office-world-integration.js`, `package.json`, Supabase code and original GLB files unchanged.
6. Commit the replacement file and test to `main`.

## Important scope boundary

The repository's current office GLB catalogue contains a desk, computer, reception desk and headset. It does not contain GLB models for office chairs, training chairs, server racks, sofas, partition walls, windows, floor/ceiling architecture or a complete office interior. Those objects therefore remain procedural. This upgrade does not pretend otherwise and does not stretch existing models into unrelated objects.

## Verification

Run `npm test` and `npm run build` in GitHub Actions/Vercel after committing. The included six tests cover the new transform; they do not prove that every binary GLB visually fits every station. Check the live GLB status readout and phone performance after deployment.
