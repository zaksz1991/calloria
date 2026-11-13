# Install CALLORIA v6.40

Apply over CALLORIA v6.39.

## Replace one production file

Replace the complete contents of:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Use the identically named file in this ZIP. Do not replace `package.json`, `package-lock.json`, Vite configuration, Supabase settings, environment variables, or unrelated production files.

The ZIP carries forward the existing regression suite and adds:

`tests/calloria-v640-contact-session-dialogue.test.mjs`

## After deployment

The staff runtime should install `window.CalloriaContactDialogue` after the existing browser voice and staff dialogue APIs. The CRM/call-handling page must still call this API or dispatch `calloria:contact-dialogue` events; this patch does not alter that page. Read `README.md` for the API, event payloads, lifecycle rules and integration boundary.
