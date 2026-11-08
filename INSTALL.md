# CALLORIA Customer Avatar v1.5 — Installation

This is a focused replacement for the customer avatar preview lifecycle. It reduces repeated WebGL context creation during the Customer Intelligence Lab's normal re-render cycle and updates customer body language when the latest agent response changes the reaction state.

## Files

Replace:

- `js/customer-avatar-stage.js`

Add:

- `js/customer-avatar-lifecycle.js`
- `tests/customer-avatar-lifecycle.test.mjs`

Do not replace `js/main.js`, `js/production-world.js`, `vite.config.js`, `package.json`, the customer intelligence engine, the GLB registry, or any original GLB files.

## Requirements

This patch expects the existing v1.4 customer-avatar files and current CALLORIA GLB loader/registry. It uses the existing Three.js dependency and does not add packages or change build configuration.

## Verification

Run the project's normal test command and production build in CI. The included lifecycle tests are standalone Node tests. This package has not been tested against the live Vercel deployment or in a real browser/device; confirm the previous v1.4 build correction has passed before promoting this patch.

## Behaviour

- Same selected customer GLB: retains one renderer, scene, loaded model and animation mixer across panel re-renders; reattaches the canvas to the new DOM container and updates the emotional motion target.
- Different selected customer GLB: disposes the previous stage and creates a new stage for the newly selected model.
- No approved compatible GLB: keeps the existing instruction/fallback message; it does not display unapproved customer models.
- Page exit: stops animation, disconnects observers/listeners and disposes the renderer and shared loader cache.
