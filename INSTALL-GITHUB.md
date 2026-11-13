# Install CALLORIA v6.41

Upload these three overlay files to the repository, preserving the folders:

1. `build/calloria-contact-voice-integration-v6-41.mjs`
2. `tests/calloria-v6-41-contact-voice-bridge.test.mjs`
3. Replace the repository's existing `vite.config.js` with the supplied `vite.config.js`.

Commit to the `main` branch. Vercel should then run the existing project build. No environment variables, Supabase settings, API keys, GLB folders or package files need to be changed.

The Vite configuration in this patch is based on the current public `main` branch configuration and only adds the new final plugin import and registration.
