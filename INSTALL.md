# CALLORIA Customer Behaviour & 3D Avatar Stage v1.4

## Purpose
Adds a 3D visual representation of the synthetic customer inside the existing Customer Intelligence Lab. It does not place a remote caller physically inside the office. It is a training visual for voice and digital simulations.

## Files
- `vite.config.js` — complete replacement based on the current repository configuration; adds one version-checked Vite plugin.
- `build/calloria-customer-avatar-plugin.js` — injects the stage into the existing Customer Intelligence Lab and expands customer behaviour profiles without editing `main.js` or `customer-intelligence-engine.js`.
- `js/customer-avatar-stage.js` — loads an explicitly approved customer GLB, validates its rig and geometry, and animates mood/body-language cues.
- `js/customer-avatar-profile.js` — deterministic behaviour-to-pose rules and runtime model budgets.
- `styles/calloria-customer-avatar.css` — responsive stage styling.
- `tests/*.test.mjs` — focused integration and behaviour tests.

## Installation
Merge the ZIP contents into the repository, preserving folders. Replace only the root `vite.config.js`. Add the other files. Do not replace `main.js`, `customer-intelligence-engine.js`, `production-world.js`, `package.json`, the lockfile, Supabase files or original GLBs.

## Customer model approval
The stage does not assume that `robbert-visitor.glb` or `ribbert-customer.glb` is visually suitable. Open `/asset-inspector.html`, inspect the two models visually, and approve only a suitable, rigged, human-looking model. The stage reads the existing `calloria.glb-inspector.v1` approved asset list and uses only those customer/visitor assets.

If neither model is approved, the stage displays a clear approval message. It does not silently show an unreviewed model or generate a fake 3D person.

## Behaviour profiles added
Happy and appreciative, playful and chatty, impatient and demanding, anxious and worried, skeptical and questioning, sarcastic but conversational, distressed and overwhelmed, hostile and verbally abusive, and talkative/easily distracted. The existing confused profile remains the plain-language/step-by-step support case. No derogatory disability label is used.

Agent responses already change customer patience and reaction in the existing engine. The avatar maps the resulting improving/steady/deteriorating reaction and persona emotion into restrained skeletal body-language changes. Embedded model clips are used when suitable clips are present. A seated employee/agent animation is not altered.

## Safety/performance
- A customer model must be explicitly approved in the inspector.
- Runtime acceptance requires human-scale dimensions, a usable skeleton (15–180 bones), no more than 120,000 triangles, no more than 100 meshes and textures no larger than 4096px.
- One avatar is rendered at a time, in the Customer Intelligence Lab only.
- The source GLB cache is reused across Lab turns; original models are not modified.
- If WebGL, model loading or validation fails, the practice interaction remains usable and a clear fallback message is shown.
- Reduced-motion preference is respected.

## Verification
Run the repository's existing `npm test` and `npm run build`. This package includes focused Node tests; a full application build and visual browser review must still be performed in the repository environment.
