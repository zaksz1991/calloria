# Install CALLORIA v6.38

Apply on top of CALLORIA v6.37.

## Replace one file

Replace the complete contents of:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Use the identically named file in this ZIP. Do not replace `package.json`, `package-lock.json`, Vite configuration, Supabase settings, or any other production file.

The ZIP includes the existing regression suite plus the expanded v6.37 speech-bridge tests. The only production replacement is the build plugin.

## API usage

Call `window.CalloriaStaffVoice.enqueue({ assetId, text, lang })` to add sequential dialogue. Use `pause()`, `resume()`, `clearQueue(assetId?)`, and `getQueueState()` for playback control. Direct `speak()` remains interruptive and clears pending queue entries.

The actual contact-handling UI still must invoke this API. See `README.md` for examples.
