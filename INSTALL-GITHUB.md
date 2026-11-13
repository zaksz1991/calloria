# Install CALLORIA v6.42

Upload the files while preserving their paths:

1. Add `build/calloria-voice-response-workflow-v6-42.mjs`.
2. Add `tests/calloria-v6-42-voice-response-workflow.test.mjs`.
3. Add `tests/fixtures/calloria-v6-42-main-anchors.fixture.js`.
4. Replace the repository's `vite.config.js` with the supplied version.

Commit the changes to the `main` branch. Vercel should then run the existing project build.

No package dependencies, package lock, Supabase configuration, API keys, environment variables or GLB assets are changed. The Vite configuration is based on the current `main` branch configuration and registers this plugin as the final application transform.

After deployment, open an inbound call, give microphone consent, use live transcription or the text fallback, then select **Log agent response to contact**. The saved statement appears in the active interaction history and in the CRM case transcript after wrap-up.
