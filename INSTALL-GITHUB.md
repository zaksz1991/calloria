# GitHub installation — CALLORIA v6.23

Replace exactly one production file on the `main` branch:

| Repository path | Action |
|---|---|
| `build/calloria-cc0-staff-glb-bundle-plugin.mjs` | Replace with the matching file in this ZIP |

Keep the existing Vite plugin registration unchanged. Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `js/glb-world-integration.js`, `js/production-world.js`, any Supabase configuration, or `public/assets/models/`.

The ZIP also includes optional regression tests:

- `tests/calloria-v623-runtime-diagnostics.test.mjs`
- `tests/calloria-v622-transform-aware-bounds.test.mjs`
- `tests/fixtures/glb-world-integration-v12.fixture.js`

The tests may be copied into the repository's existing `tests/` directory. They do not need to be part of the production app bundle.

## Verify the deployed audit page

After the Vercel deployment completes, open:

`https://calloria.vercel.app/calloria-staff-glb-diagnostics.html`

The page separately reports:

1. Which staff GLBs passed build validation.
2. Whether the Vite build transformed the staff and office runtime source files or skipped them, including the precise warning.
3. Whether the corresponding `.glb` files are reachable from production and begin with a valid GLB header.

A `patched` result means the build transform was applied. A `reachable` result means the file is deployed. Neither result alone proves the model was placed or visibly rendered in the 3D scene.
