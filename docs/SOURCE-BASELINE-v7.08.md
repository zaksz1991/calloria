# CALLORIA v7.08 — Source baseline

Audited current public `main` on 22 November 2026.

- `index.html` links `/styles.css`, `/performance-mobile.css`, and `/calloria-mobile-runtime-v6-80.css` in its document head. The latter reference is at line 15 of the raw `main/index.html` response.
- The direct raw URL for `calloria-mobile-runtime-v6-80.css` returned a not-found response during the audit; this release restores the exact missing root filename without modifying the HTML.
- `performance-mobile.css` already contains launch/assessment touch rules, but it does not itself replace the missing linked stylesheet.
- `styles.css` provides a fixed horizontal bottom navigation under 760px and core app mobile rules. The Shift Command Centre launcher CSS later fixes itself to the bottom-right, which can collide with the bottom navigation; this overlay raises that launcher above the navigation.
- The public `vite.config.js` uses `publicDir: 'public'`, but the main app's root CSS files are referenced directly from `index.html`. The added stylesheet is placed beside the existing root `styles.css` and `performance-mobile.css`, consistent with those references.

Source references:

- `https://raw.githubusercontent.com/zaksz1991/calloria/main/index.html`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/styles.css`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/performance-mobile.css`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/calloria-shift-command-centre-v6-90.css`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js`

Scope limitation: this is a CSS overlay based on the currently public main source. The full repository was not present in the workspace, and no full Vite production build or physical device test was run.
