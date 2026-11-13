# Verification

## Included automated checks

`tests/calloria-v6-41-contact-voice-bridge.test.mjs` checks the source transform for:

- runtime-confirmed GLB asset ID publication;
- inbound session startup;
- automatic agent-line speech and manual replay control;
- hold, resume, wrap-up and return-to-queue cleanup;
- safe skip when source anchors change;
- duplicate-transform protection.

The plugin's transform tests are run against a post-v4.4 source fixture. They do not replace the full repository test suite.

## Not verified in this patch environment

The full current repository checkout and its installed dependencies were not available in the workspace. Therefore a full Vite production build, complete `npm test`, browser rendering, speech playback, GLB morph animation or Vercel deployment has not been claimed or verified. Vercel must complete the production build after the overlay is committed.
