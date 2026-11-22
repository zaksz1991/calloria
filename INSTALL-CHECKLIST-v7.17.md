# CALLORIA v7.17 installation checklist

- [ ] Back up/commit current CALLORIA source.
- [ ] Merge `js/`, `build/`, `styles/` and `tests/` folders from the ZIP.
- [ ] Add the Vite plugin import shown in `VITE-CONFIG-ADDITIONS-v7.17.txt`.
- [ ] Register `calloriaDigitalSpecialistHandoffPluginV717()` exactly once at the end of the plugin array.
- [ ] Keep any installed v7.16 plugin before v7.17.
- [ ] Do not replace `main.js`, `index.html`, `package.json`, `vite.config.js` or `vercel.json` wholesale.
- [ ] Commit and push to `main` through GitHub Desktop.
- [ ] Check Vercel build output for `calloria-digital-specialist-handoff-v7-17` source transformation errors.
- [ ] Test a valid and invalid specialist handoff in the synthetic digital desk.
- [ ] Verify the supervisor request appears and remains awaiting supervisor review.
- [ ] Verify actual WhatsApp and SMS inboxes remain unchanged.
