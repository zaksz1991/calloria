# CALLORIA v6.99 Source Baseline

Audit date: 21 November 2026.

Inspected public `main` source:

- `js/operations-intelligence-workbench.js`
- `operations-intelligence.html`
- `styles/operations-intelligence.css`
- `js/operations-intelligence-engine.js`
- `vite.config.js`

## Verified integration points

1. `operations-intelligence.html` contains the Operations Intelligence Command Centre, uses `styles/operations-intelligence.css`, loads `js/operations-intelligence-workbench.js`, and ends the workspace immediately before `<footer class="oi-footer">`.
2. `js/operations-intelligence-workbench.js` imports `createClient` from `@supabase/supabase-js` at the first line.
3. Its `render(snapshot)` function normalises the aggregate report and currently runs `renderChannels(s.channels);renderDaily(s.daily);` before returning.
4. The existing renderer uses `normaliseSnapshot(snapshot)`, with `overview.active_work` and `daily[]` rows containing `day`, `received` and `resolved` values.
5. `vite.config.js` has a single plugin array and currently ends with the public experience plugins, including `calloriaTryItStudioPlugin()`.
6. `operations-intelligence.css` already has responsive breakpoints at 1100px and 620px; v6.99 adds isolated responsive rules in a separate CSS file.

## Integration design

The v6.99 Vite plugin injects one section into the existing Operations Intelligence HTML and adds a stylesheet link. It patches only the Operations Intelligence workbench module, adding one pure-engine import and one render call. It does not edit `main.js`, `index.html`, `package.json`, Supabase files, or existing engine files.

If the expected workbench anchors change, the transform logs a warning and skips safely. The supplied tests use an isolated fixture containing the audited integration anchors, not a full repository checkout.

## Scope limitations

The complete repository was not checked out in this runtime. A full production Vite build, Supabase authentication, Edge Function response, and live browser render were not executed. Check the target branch before applying this overlay if its Operations Intelligence page or workbench has changed since this audit.
