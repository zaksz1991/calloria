# CALLORIA 3D World Rebuild — Phase 1

This package contains a complete replacement for:

`js/production-world.js`

It is designed against the current public `main` branch integration contract. It does not replace `index.html`, `main.js`, CSS, career engines, operations engines, Supabase files, tests, or any other application module.

## What Phase 1 changes

- Rebuilds the office as a readable, open-roof 3D contact-centre floor.
- Adds clearly separated reception, training/briefing, operations, QA, supervisor, IT/systems and staff-lounge zones.
- Adds high-resolution CALLORIA and department signage, visible glass partitions, room furniture, monitor arrays, server cabinets, seating and environmental details.
- Rebuilds all 12 addressable agent workstations. Station IDs 1–12 and the existing interaction callback are preserved.
- Adds articulated, locally generated staff with visible body, face, clothing, hair or hijab, headset, arms and legs. No model upload or remote character download is required.
- Uses instanced workstation and architectural components to reduce repeated draw calls.
- Retains the launch preview, first-person desktop controls, touch joystick, touch look, sprint, station interaction, graphics profile selector, performance readout and WebGL context recovery.
- Stops classifying every touch device as low-end. The low profile is reserved for constrained hardware signals such as low reported memory, low core count or data-saver mode.
- Keeps render resolution adaptive and avoids real-time shadow maps.

## Integration contract retained

The replacement exports `initProductionWorld(THREE, host, callbacks)` and returns `scene`, `camera`, `renderer`, `stations`, `enter`, `exit`, `setImmersive`, `setAgentActivity`, `dispose`, and the existing status/quality getters.

It preserves the callbacks consumed by `js/main.js`: `onAssetsReady`, `onImmersiveChange`, `onNearestStation`, `onStation`, `onPointerUnlock`, and `onRenderStatus`.

## Apply using the GitHub website

1. Extract this ZIP.
2. In the extracted folder, open `js/production-world.js`.
3. In the GitHub repository, open `js/production-world.js` on the `main` branch and use the browser's file replacement/edit workflow to replace the entire file with this complete file.
4. Do not replace or delete any other project file with this package.
5. Allow the existing Vercel deployment to build from the resulting `main` commit.

## Important limits

The staff are articulated procedural/local models, not photorealistic external GLB assets. They are intended as a higher-detail, coherent first rebuild without requiring the user to supply assets. Phase 2 should replace selected hero/NPC models with curated original GLB assets only if an asset pipeline is later introduced.

This package was syntax-checked with Node. It was not built inside the full repository, browser-tested, benchmarked on a physical phone, or deployed to Vercel in this environment. Do not treat the FPS target as physically verified.
