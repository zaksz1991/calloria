# CALLORIA v6.13.1 — Vercel Build Script Repair

This patch restores the root npm manifest expected by Vercel. The reported failure occurs before Vite starts because npm cannot find a `build` script.

## Why this happened

The earlier v6.13 office-runtime ZIP accidentally carried a minimal `package.json` (name/private/type only) even though its installation guide said to copy only the two JavaScript files. If that manifest was copied over the repository root, it would remove the `scripts.build` entry and produce exactly:

`npm error Missing script: "build"`

That packaging mistake is ours.

## Installation

Replace **only the repository-root `package.json`** with the supplied file.

Do not copy this file into a subfolder. Do not replace `package-lock.json`, `vite.config.js`, any source modules, plugins, or GLB assets.

The manifest restores:

- `npm run dev`
- `npm run build` → `vite build`
- `npm run preview`
- `npm run check`
- `npm test`

It pins Vite to `6.4.5` and Three.js to `0.170.0`, matching the CALLORIA build environment represented in the supplied build logs. It preserves Node `>=22.12.0`.

If the repository currently uses additional npm dependencies beyond Three.js and Vite, retain those existing dependency entries when merging this root manifest. The supplied manifest is aligned to the current logged CALLORIA 0.3.0 build profile, not a claim that every unpublished local dependency was inspected.
