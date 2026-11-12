# CALLORIA v6.20 — Office Visual Finish

This is a small overlay on v6.19. It refines the real reception lobby and glazed department partitions without replacing project configuration or existing GLB assets.

## Changes

- Recognized glazing materials in the partition GLB receive two-sided transparency and restrained PBR settings. Unrelated frame materials are untouched.
- Partition runtime status reports how many glass materials were scanned, matched and finished. A zero match count is reported honestly; no material is relabelled as glass.
- Lobby meshes receive shadows on balanced/high graphics tiers, allowing existing dynamic staff/props to cast onto the lobby when the renderer already has shadow mapping enabled. Low tier keeps this disabled.
- Existing fallbacks, async lifecycle and disposal remain intact.

## Scope

The package does not change Vite configuration, package files, Supabase, Groq, `production-world.js`, GLB asset files or global renderer settings.
