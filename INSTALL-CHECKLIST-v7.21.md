# v7.21 installation checklist

- [ ] Back up or commit existing work.
- [ ] Merge the four supplied files into `js/`, `build/`, `styles/` and `tests/`.
- [ ] Add the one plugin import to `vite.config.js`.
- [ ] Add `calloriaDigitalResponseCyclePluginV721()` once at the end of the plugin array.
- [ ] Preserve all existing plugin registrations and plugin order.
- [ ] Confirm `package.json` still runs `node --test tests/*.test.mjs`.
- [ ] Commit and push to `main`.
- [ ] Confirm Vercel build passes.
- [ ] Open a simulated digital contact, send the first reply, receive the customer follow-up, and confirm the FOLLOW-UP RESPONSE SLA card appears.
- [ ] Advance the simulated shift clock to verify due-soon and overdue states.
