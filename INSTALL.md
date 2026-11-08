# CALLORIA Customer World Integration v1.6

This additive upgrade places approved customer/visitor GLB characters into the existing production-world reception using the existing Three.js scene and animation loop. It does not create another WebGLRenderer. It also forwards synthetic Customer Intelligence Lab persona/reaction changes to the reception visitors.

## Files

Add:
- `js/customer-world-integration.js`
- `build/calloria-customer-world-plugin.js`
- `tests/customer-world-integration.test.mjs`

Replace the root `vite.config.js` with the supplied complete version. It preserves the current main entry points, public asset handling, existing world plugin and optimized GLB plugin, and adds the customer-world plugin.

Do not replace `js/main.js`, `js/production-world.js`, `package.json`, the existing customer-intelligence engine, or any GLB asset.

## Important behavior

- Only `robbert-visitor` and/or `ribbert-customer` models explicitly approved in the GLB Asset Inspector are eligible.
- Models must pass the existing runtime customer-rig validator.
- Low/balanced graphics tiers show one customer. High tier may show two.
- Characters appear in the existing reception/check-in queue, not in a separate preview renderer.
- The existing world renderer and animation loop are reused.
- New customer sessions reset the reception characters to the selected persona's initial emotion. Each submitted response forwards the calculated customer reaction and patience to the world.
- If no customer asset is approved or compatible, the existing workplace continues normally without forcing an unverified model into the scene.
- Existing GLB files are not overwritten.

## Run

Commit these files to `main`. Run the repository's existing tests and Vercel build. Then open the GLB Asset Inspector on the deployed origin and approve at least one suitable customer/visitor GLB. Refresh the CALLORIA workplace. Customer figures should appear at reception. Start a synthetic Customer Intelligence Lab scenario and submit an agent response; the reception visitor's body language/available animation should respond to the persona and calculated reaction.

## Verification boundary

The included tests validate the build transform and event bridge. They do not prove that either downloaded customer model passes the runtime rig test or that it looks natural in the actual browser. The world integration reports loaded/rejected model status through `calloria:customer-world-ready` and the optional `onCustomerWorldReady` callback.
