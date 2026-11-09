# Verification record

## Passed in this package workspace

- JavaScript syntax check for the v3.1 Vite plugin.
- JavaScript syntax check for the browser chair integration module.
- JavaScript syntax check for the Node regression test.
- Focused Node test suite: **9 tests passed**.
- Transform output syntax validation using a synthetic v3.0 production-world fixture.
- Idempotence and fail-closed behavior when the v3.0 marker or source anchors are absent/changed.
- Vite plugin order check: all included earlier plugin registrations remain present and v3.1 follows the v3.0 lobby stage.

## Not run

- The complete CALLORIA repository was not available in this overlay workspace.
- The full application production build was not run.
- No deployed website or live browser render was tested.
- The remote GLB was not fetched from an actual user browser/device in this verification run.
- Visual alignment of the 460 mm chair seat with each animated staff model must be confirmed in the actual scene. The integration keeps existing chairs as the failure fallback but does not alter character rig transforms.

## Test command

`node --test tests/calloria-ergonomic-office-chairs.test.mjs`
