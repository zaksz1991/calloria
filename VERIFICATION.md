# Verification — CALLORIA v6.18

Verified locally:

- Focused Node contract tests pass.
- JavaScript syntax checks pass for both runtime modules and the Vite plugin.
- The v6.17.1 `integrateCalloriaCC0Lobby` compatibility export is preserved.
- Existing Vite plugin import/call contract is preserved; the obsolete text-anchor transform is disabled.
- ZIP archive integrity passes.

Not verified:

- Full Vite production build against the user's complete current repository.
- Vercel deployment.
- Browser rendering or whether the deployed reception GLB contains planter nodes that satisfy the geometry/name filters.
