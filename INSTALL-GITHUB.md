# Install CALLORIA v6.43

This is a ZIP overlay for the existing repository, not a complete project archive.

1. Extract the ZIP.
2. Add `build/calloria-voice-response-workflow-v6-42.mjs`.
3. Add `build/calloria-inbound-customer-dialogue-v6-43.mjs`.
4. Add the two test files under `tests/` and their fixtures under `tests/fixtures/`.
5. Replace the repository's `vite.config.js` with the supplied version.
6. Commit the changes to the `main` branch and review the Vercel build result.

The v6.42 build plugin and test fixture are included so that the new configuration can register the complete voice-to-CRM and live-dialogue sequence even when v6.42 was not previously added to the repository.

## In-game check

Start a shift, accept an inbound contact, and open the new **Live customer conversation** panel. Enter a response and send it. The scripted customer should reply, the tone indicator should update, and the exchange should appear in the contact history. Use the existing voice transcription controls and select **Send captured voice transcript** to send recognized speech through the same dialogue flow.

## Preserved

No package dependencies, package lock, Supabase migrations, credentials, API keys, environment variables or GLB assets are changed. The overlay only adds build plugins/tests and replaces Vite configuration to register them.
