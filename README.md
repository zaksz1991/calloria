# CALLORIA Customer Avatar v1.5

## Purpose

This patch improves the customer avatar stage added in v1.4. When the Customer Intelligence Lab redraws after each agent reply, the old implementation disposed its renderer and created a fresh WebGL context. This patch reuses the renderer, loaded model and animation mixer when the selected customer model remains the same.

## User-visible result

The same approved customer avatar remains on screen between practice turns. When the customer reaction changes, the caption, compatible embedded animation and skeletal body-language target update, with a short smooth transition rather than a sudden pose snap.

## Safety and compatibility

- Original GLB files are not modified.
- No additional npm packages are introduced.
- The GLB Inspector approval requirement remains.
- Existing customer model geometry, skeleton and texture budgets remain.
- If a different customer GLB is selected, the previous stage is disposed and the new model is loaded.
- If no approved compatible model exists, the current safe unavailable state remains.
- When the stage is removed from the DOM, its render loop pauses. Rebinding the same stage restarts it.

See `INSTALL.md` before merging.
