# Verification — CALLORIA v6.2

## Focused checks performed

| Check | Result |
|---|---:|
| Office-floor engine and route-contract tests | 26 passed, 0 failed |
| `office-floor-engine.js` syntax | Passed |
| `office-floor.js` syntax | Passed |
| Updated `live-floor.js` syntax | Passed |
| Duplicate IDs on both HTML pages | None |
| v6.0/v6.1 local-storage read contracts | Passed |
| GLB loading and workstation gate contracts | Passed |
| ZIP integrity | Passed (`unzip -t`) |

## Not performed

- Full CALLORIA repository tests.
- Vite production build.
- Vercel deployment.
- End-to-end browser render against the deployed website.
- Actual GLB load verification against the user's production `/assets/models/` directory. Those asset files are not present in this patch workspace.

## Known constraints

- Three.js 0.170.0 is loaded from a pinned CDN import map; a connection to that CDN is required to start the renderer.
- The actual GLB files are not included in the patch. The page tries multiple filename candidates under the known model folders and reports successful or missing paths in the asset inspector.
- Workstation entry requires both desk and computer GLBs. Agent and supervisor GLBs are optional and are never replaced with primitive character geometry.
- The 3D floor is a first-person prototype. Furniture collision, multiplayer, audio, live telephony and live digital channels are not included.
- The package assumes the v6.1 base engines remain installed in `public/`.
