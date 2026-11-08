# v1.3 — GLB staff motion integration

- Makes the two primary male/female staff GLBs the default checked candidates when no explicit inspector approvals have been saved.
- Retains explicit inspector approvals as the override when present.
- Permits a rig-aware procedural idle loop for standing support staff whose GLB has a skeleton but no embedded idle clip.
- Keeps seated agents on the existing procedural fallback unless the GLB contains a seated/typing clip.
- Syncs replacement wrapper transforms with the existing staff root each animation update.
- Corrects source-model cleanup to dispose the stored `gltf` object rather than the wrapper record.
- Preserves the exact build-transform anchors used by the repository's Meshopt runtime plugin.
