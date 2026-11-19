# CALLORIA v6.80 — Verification

## Focused checks

| Check | Result |
|---|---|
| Launch screen hidden outside launch state | Covered by regression test |
| Mobile runtime CSS loads after existing mobile stylesheet | Covered by regression test |
| Runtime guard loads before `js/main.js` | Covered by regression test |
| Mobile canvas sizing follows visual viewport | Covered by regression test |
| GLB diagnostic card hidden in phone gameplay | Covered by regression test |
| Observer wake-up limited to immersive `#worldCanvas` | Covered by regression test |
| Visual viewport, orientation and tab-visibility listeners | Covered by regression test |

## Scope and limits

The repair is an overlay for the existing `main` branch. It does not replace the complete repository and does not alter GLB files, Supabase tables, Edge Functions, secrets, scoring or recruitment logic.

The supplied screenshots show the launch surface and operational Home content together, plus a full-screen 3D view with a developer GLB status card occupying the top area. The current root `index.html` only hides the launch surface in `calloria-game-playing`; it did not explicitly hide it when the body had left launch mode for a normal app view. The v6.80 stylesheet adds that missing negative-state rule.

The 3D world uses an `IntersectionObserver` to pause its render loop when the canvas is outside view. The guard makes the already-fixed full-screen world canvas count as visible while immersive mode is active and wakes the existing observer after viewport changes. It does not create a second renderer or a second animation loop. The phone HUD also suppresses the desktop GRAPHICS control because it previously occupied the same top-right area as EXIT GAME.

**Not verified:** Vite production build, Vercel deployment, device browser rendering, GPU/context recovery, and real GLB load success. The screenshot's `GLB STAFF 0 · OFFICE OBJECTS 0` is not re-labelled as a success. Use `/asset-inspector.html` for the actual asset-load diagnosis.
