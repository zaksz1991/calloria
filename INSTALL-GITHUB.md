# Installation — CALLORIA v6.33

Apply this patch over v6.32.

In GitHub, open:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Replace its complete contents with the file at the same path in this ZIP, then commit to `main`.

No other application file needs to be replaced. Do not replace `package.json`, the lockfile, Vite configuration, Supabase settings or API keys.

The change extends blink-morph discovery to unskinned static-mesh staff GLBs. Authored animated GLBs remain on their existing AnimationMixer path. Actual blink behaviour still depends on the GLB containing compatible eye-blink morph targets.
