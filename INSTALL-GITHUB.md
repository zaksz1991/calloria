# Installation — GitHub web interface

1. Open the `zaksz1991/calloria` repository on GitHub and select the `main` branch.
2. Open `build/calloria-cc0-staff-glb-bundle-plugin.mjs`.
3. Replace the entire file with the file at the same path in this ZIP. Do not merge fragments.
4. Commit the change to `main` and allow Vercel to deploy.

This is a complete replacement for the existing CALLORIA staff GLB build plugin. It preserves the existing plugin factory/export, plugin name, office runtime transform, manifest generation and v6.23 deployment diagnostics. Apply it after the v6.25 GLB audit package.

After deployment, the staff runtime status includes `proceduralIdlePlaced`. A positive count means static-pose GLBs were given subtle root-level idle motion; it does not mean those models have articulated bone animation.
