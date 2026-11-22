# CALLORIA v7.12 installation checklist

- [ ] Back up the existing CALLORIA repository folder.
- [ ] Add `js/callback-integrity-engine-v712.js`.
- [ ] Add `build/calloria-callback-integrity-v712-plugin.mjs`.
- [ ] Add `styles/calloria-callback-integrity-v712.css`.
- [ ] Add `tests/callback-integrity-v712.test.mjs`.
- [ ] Add the plugin import to `vite.config.js`.
- [ ] Register `calloriaCallbackIntegrityPluginV712()` exactly once after the existing final plugin.
- [ ] Preserve all existing plugin registrations and application files.
- [ ] Commit and push through GitHub Desktop.
- [ ] Confirm the Vercel build succeeds.
- [ ] Open Promise Control and inspect the Callback task integrity panel.
- [ ] Confirm the panel reports findings without mutating saved callback or commitment records.
