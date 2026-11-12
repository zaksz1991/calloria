# CALLORIA v6.22 — Staff GLB Transform-Aware Validation

This patch corrects staff-character dimension checks that previously measured raw POSITION accessor bounds without applying the active glTF scene's node hierarchy.

## What changes

- Computes character bounds from meshes reachable through the active/default glTF scene.
- Applies each ancestor node's full transform, including matrix transforms and TRS translation, rotation and scale.
- Avoids allowing an unreferenced mesh elsewhere in the GLB to distort the active character's reported dimensions.
- Keeps the existing human-proportion limits, triangle limits, GLB size limits, skin validation and static-pose handling.
- Rejects cyclic or invalid active-scene node hierarchies instead of risking unsafe traversal.
- Includes effective scene-space dimensions in the build manifest and Vercel model log.
- Preserves the existing Vite plugin name, factory API, staff asset destinations, staff runtime transform and v6.15 office-world transform.

This is a validation correction, not a geometry rescaling operation. GLB transforms already encoded in the asset remain intact. Truly oversized or undersized characters still fail the existing proportion limits.

## Expected result

A model with large local accessor coordinates but a valid scale in its active scene hierarchy can now pass proportion validation. The Vercel log reports the measured scene-space bounds in metres so the result can be checked directly.
