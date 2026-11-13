# Install CALLORIA v6.39

Apply over CALLORIA v6.38.

## Replace one production file

Replace the complete contents of:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Use the identically named file in this ZIP. Do not replace `package.json`, `package-lock.json`, Vite configuration, Supabase settings, environment variables, or any other production file.

The ZIP also carries forward the complete regression suite and adds `tests/calloria-v639-staff-dialogue-adapter.test.mjs`.

## After deployment

The browser runtime installs `window.CalloriaStaffDialogue` next to the existing `window.CalloriaStaffVoice` API. The actual contact-handling UI still must call the new API or dispatch the documented event. See `README.md` for the event schema and examples.
