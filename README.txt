CALLORIA Optimized GLB Deployment v2

Purpose:
- Decode Meshopt-compressed assets in both Three.js GLTFLoader paths.
- Prefer promoted optimized models at runtime using a deployment manifest.
- Fall back to original GLBs whenever optimized assets are unavailable or fail to decode.
- Make the existing GitHub optimization workflow publish accepted copies to public/assets/models-optimized without overwriting original models.

Read INSTALL.md before applying.
