# CALLORIA v4.0 — Verification report

## Completed in the patch workspace

- Focused static contract tests: 7 passed, 0 failed.
- Inline JavaScript module syntax: checked separately with Node.
- ZIP integrity: checked after packaging.
- No package dependencies added.
- No existing runtime/configuration files replaced.

## Not verified

- Full repository `npm test`.
- Full Vite production build on the current main branch.
- Vercel deployment.
- jsDelivr module availability on the user's device/network.
- Live manifest fetch, GLB fetch or actual WebGL browser rendering.
- Whether v3.9 has been installed and deployed.
- Whether the models appear correctly in the main 3D office scene.

## Acceptance rule

Do not report the GLB integration complete until the deployed page shows successful browser renders for actual staff models and the corresponding models are also visible in their intended positions in the main game. The manifest alone is not sufficient evidence.
