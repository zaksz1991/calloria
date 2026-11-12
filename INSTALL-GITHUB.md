# CALLORIA v6.17 — GitHub Installation

This package is a three-file overlay. It does not contain a replacement Vite configuration or package manifest.

## Replace one file

In the `zaksz1991/calloria` GitHub repository, replace the existing file:

`js/glb-office-world-integration.js`

Use the file at the same path inside this ZIP.

## Add two files

Add these new files at the exact repository paths:

`js/cc0-office-lobby-integration.js`

`js/cc0-office-lobby-policy.js`

## Preserve everything else

Do not replace or delete:

- `vite.config.js`
- `package.json` or `package-lock.json`
- `build/calloria-cc0-staff-glb-bundle-plugin.mjs`
- `js/production-world.js`
- `js/cc0-office-chair-integration.js`
- `js/office-chair-policy.js`
- `js/glb-office-asset-policy.js`
- `js/glb-office-draco-policy.js`
- `js/glb-asset-loader.js`
- `js/glb-asset-registry.js`
- `public/assets/models/`
- the mobile/assessment repair files

After the three file changes are saved to `main`, Vercel should run the existing `npm run build` command. The package does not change build scripts or dependencies.

## Expected runtime behaviour

- Low graphics: uses existing procedural reception.
- Balanced/high: asynchronously loads the complete lobby GLB.
- If the full lobby fails: tries the existing reception-desk GLB.
- If both fail: keeps the original procedural reception visible.

The lobby is downloaded at runtime from the documented CC0 CDN. This patch does not bundle the GLB binary.
