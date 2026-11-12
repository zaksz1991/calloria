# CALLORIA v6.21 — Lobby Greenery Shadow Polish

This overlay builds on v6.20. It improves the way the existing validated CC0 reception plants render without adding new models, changing the lobby layout, or increasing the number of foliage draw calls beyond the material/attribute batches already present in the plant asset.

## Changes

- Separates foliage from architectural mesh batches while retaining batching within the foliage family.
- Lets foliage cast shadows on balanced/high tiers; the lobby continues to receive shadows on those tiers.
- Keeps all shadow casting/receiving disabled on low tier.
- Leaves the static building shell non-casting to avoid an unnecessary shadow-map workload.
- Exposes decorative batch and shadow-caster counts in the existing `calloria:glb-lobby-ready` status detail under `lighting` and `decorativeBatches`.

No new locations, geometry, textures, GLB assets, global renderer settings, Vite config, package manifests, Supabase settings or API keys are changed.
