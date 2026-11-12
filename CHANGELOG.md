# v6.22

- Replaced accessor-local dimension checks with active-scene, node-transform-aware bounds.
- Added glTF matrix and TRS transform traversal with cycle protection.
- Limited character-proportion measurement to meshes reachable from the active scene.
- Preserved the existing Vite plugin identity and v6.15 office GLB transform.
- Added regression coverage for scaled ancestors, tiny local models, matrix transforms, quaternion rotation, unreferenced meshes, cyclic nodes and unchanged proportion limits.
