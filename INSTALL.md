# CALLORIA v2.5 — In-World Workstation Gameplay

## What this upgrade changes

- Registers the existing third-person GLB player plugin in Vite; it was present in `build/` but absent from `vite.config.js` on the inspected `main` branch.
- Keeps the production-world renderer active when an agent chooses Inbound, Outbound, Digital, CRM, Queue, Supervisor or Knowledge from a workstation.
- Displays CALLORIA's existing operation screen as a glass console over the 3D workplace rather than leaving the world and navigating to a separate page.
- On mobile, places the operational console in a scrollable lower sheet and temporarily hides movement controls while the agent is working.
- Resuming the 3D floor hides the console without resetting the character's location.
- Exiting the floor fully returns to the regular application interface.
- Uses embedded GLB work/talk animation clips when available. If a source model has no such clips, the status remains honest and no fake seated/talking rig is generated.
- Pauses player movement while the workstation console is active. The 3D renderer and world animation loop continue running behind the console.

## Files

Replace the root `vite.config.js` with the supplied full replacement.

Replace `build/calloria-third-person-player-plugin.mjs` with the supplied workstation-aware version.

Add `build/calloria-workstation-experience-plugin.mjs`.

Add `tests/calloria-in-world-workstation.test.mjs`.

Keep your existing `package.json`, lockfile, `js/main.js`, `js/production-world.js`, `js/world-player-avatar.js`, all business logic, Supabase configuration and original GLB files unchanged. The new Vite plugin transforms `main.js` and `world-player-avatar.js` at build time; it does not overwrite them.

## Expected behaviour

1. Enter the 3D workplace. The third-person player model loads if the candidate GLB passes its existing runtime checks.
2. Walk to a workstation and tap USE.
3. Choose Inbound Desk, Outbound Campaigns, Digital Support, CRM & Cases, Queue, Supervisor or Knowledge.
4. The existing operational screen opens over the still-running 3D scene. The agent does not walk while the console is open.
5. Inbound call connection changes the player's requested activity to `talking`; case save changes it to `working`. The avatar only plays those clips if the selected GLB actually contains matching embedded animations.
6. Tap RETURN TO 3D GAME to close the console and resume movement from the same place.
7. EXIT GAME still exits the 3D workplace and returns to the normal application.

## Verification boundary

The included focused Node tests and syntax checks validate the plugin transformations. They do not prove that the repository's complete Vercel build or the actual phone browser rendering succeeds. Confirm those with the next Vercel deployment and a mobile browser test.
