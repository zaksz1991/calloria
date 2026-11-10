# Changelog

## v3.4.0 — In-world operations and GLB runtime repair

- Register Three.js Draco decoding for the existing staff GLB loader and bundle the matching decoder runtime.
- Reject player GLBs that lack a usable skinned rig and recognisable idle + walk animation clips, preventing the third-person camera from accepting an obvious static/default pose.
- Add a compact route from the immersive 3D floor directly into the existing inbound operations screen.
- Reduce the mobile height and width of the first-workstation tutorial card.
- Add focused transform regression tests and deployment verification boundaries.
