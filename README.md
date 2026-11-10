# CALLORIA v3.8.0 — GLB Runtime Visibility

A small, non-destructive overlay for the current v3.7.2 repository state.

### What changes in game

When entering the 3D floor, the user can open a compact `3D ASSET STATUS` panel. It reports actual GLB placements separately from local fallback geometry. A zero count is explicitly shown as `NO GLB MODELS PLACED — THE VISIBLE FALLBACKS ARE NOT GLB ASSETS.` Rejected staff models and office load failures are listed with their reported reasons.

This makes it possible to distinguish:
- a model listed in the registry;
- a binary that exists in the repository;
- a GLB that successfully loaded;
- an asset that was actually placed in the scene;
- a local fallback object.

These are different states. Registry entries and decoder registration alone do not prove that a model was rendered.

### What this release does not do

It does not add or replace any `.glb` binary. If the runtime panel reports zero characters, the missing step is still the actual approved character asset or the reason the candidate was rejected. If it reports zero office placements, inspect the specific missing path, decoding, CORS, bounds or placement error before changing the geometry.

### Preserved product scope

Recruitment remains the employment entry gate. Product/service knowledge, CRM/logging practice, agent shadowing, supervised practice and trainer sign-off remain prerequisites before an independent desk is allocated. The main game remains multi-industry customer operations and career progression, not a bank-only training quiz.

### Verification boundary

See `VERIFICATION.md`. Unit/syntax checks do not establish a passing full Vite build, deployed runtime, or successful GLB rendering.
