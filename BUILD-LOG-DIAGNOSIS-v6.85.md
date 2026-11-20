# CALLORIA Vercel build log diagnosis

## Blocking error

The build stops in `build/calloria-third-person-player-plugin.mjs` with:

`expected exactly one combined GLB-ready callback anchor (0 found)`

This is a stale source-transform contract, not an npm dependency failure. The old plugin expects an internal callback produced by a particular older GLB-world transform. The current `js/production-world.js` source no longer exposes that callback in the expected form. The Vercel log shows that Vite reached 46 transformed modules and then the plugin deliberately aborted the build because the required string was absent.

The current source instead exposes a stable ready sequence:

- `callbacks.onRenderStatus?.({ state: 'ready', ... });`
- `renderStill();`

It also uses a different disposal block and `callbacks.onImmersiveChange?.(immersive)`. The v6.84 GLB transform adds its own world-mission disposal call and `calloria:world-immersive` event. v6.85 handles both source shapes rather than requiring only the old implementation.

## Non-blocking messages

- `Unknown env config "cache-dir"`: npm configuration warning; not the build-stopping error shown here.
- `esbuild@0.25.12` install-script approval warning: separate npm policy warning; not the reported Rollup/Vite failure.
- `0 vulnerabilities`: dependency audit found no reported vulnerabilities in this install.
- The five staff GLBs are structurally compatible, but the build audit reports `0 animated` and `5 static-pose`; this does not cause the current failure.

## Other integration warnings

The log also reports safe skips for the live inbound shift integration and the v6.42–v6.54 voice, dialogue, QA/coaching, promotion, and RuffNeck support transforms. Their `main.js` anchors no longer match the source at commit `393dbd9`. These messages are warnings, not the error that terminates this build. They mean those specific transform-based upgrades were not injected by this build; this repair does not silently claim to restore them.

They need a separate rebase against the current `main.js` once the build blocker is removed.

## Verification scope

- 7 focused Node regression tests passed.
- Syntax checks passed for transformed current-world and v6.84-transformed-world fixtures.
- Tested both supported disposal/immersive source shapes.
- Confirmed the replacement does not await avatar GLB loading before the first world render.
- Confirmed mobile first-person mode skips the extra player-avatar GLB load.

A full repository `npm run build`, a Vercel deployment, and physical phone testing were not run because the complete repository checkout was not supplied in this task. The next Vercel build is the production verification step.
