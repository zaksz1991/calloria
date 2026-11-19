# CALLORIA v6.70 — Mobile State and Touch Layout Repair

## Defect evidence

The mobile screenshot shows the launch hero and the underlying CALLORIA workplace/home shell at the same time. The current public CSS makes `.game-launch-screen` visible by default, while the assessment state removes `calloria-game-launch` and `calloria-game-playing` from the body. Without an explicit default-hidden rule, the launch overlay remains displayed above the assessment or normal application shell.

The mobile aptitude layout also needs stronger single-column constraints and a full-width footer action. The immersive controls need safe-area spacing and more compact touch targets.

## Scope

- Replaces only `performance-mobile.css`.
- No JavaScript, database, Supabase, authentication, credentials, 3D models or asset paths changed.
- No external dependency added.

## Verification boundary

The CSS source was checked for balanced blocks and target selectors. Browser rendering, touch input and WebGL scene loading were not executable in this authoring environment. The blank scene and GLB diagnostic remain separate unresolved defects.
