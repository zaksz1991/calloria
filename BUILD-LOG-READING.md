# Reading the next Vercel build log

Look for the new `CALLORIA v6.12 staff GLB compatibility bundle` line.

- `N/5 structurally compatible` reports models that passed the revised build-time structural validator.
- `animated` counts models with embedded clips.
- `static-pose` counts models without a complete animation capability.

If the count remains `0/5`, inspect each `could not bundle <model>` warning. That means one of the structural checks still rejected the real file or the pinned download failed.

If the bundle reports compatible models but the game still shows `GLB STAFF 0`, the remaining failure is in the browser runtime/placement path rather than this build-time validator. The manifest at `/assets/models/calloria-cc0-staff-manifest.json` identifies the model paths and render modes for that next diagnosis.
