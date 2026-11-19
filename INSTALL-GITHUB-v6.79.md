# CALLORIA v6.79 — GUI installation

This archive contains updated folders and files only. It is not a full repository replacement.

1. Download and extract `CALLORIA-v6.79-MOBILE-ASSESSMENT-VIEWPORT-UPDATED-FILES.zip` in File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop and select **Repository → Show in Explorer**.
3. Copy the included `public` folder into the repository root and allow replacement of the two matching files:
   - `public/calloria-mobile-responsive-v6-10.css`
   - `public/js/calloria-mobile-ui-guard-v6-10.js`
4. Add the included `tests/calloria-assessment-viewport-v679.test.mjs` file under the repository's `tests` folder.
5. Add the included `docs/CALLORIA-v6.79-MOBILE-ASSESSMENT-VIEWPORT.md` file under `docs`.
6. Do not replace `js/main.js`, `index.html`, `package.json`, `vite.config.js`, Supabase files, existing models, `public/assets/` or the hidden `.git` directory. This update does not modify those items.
7. In GitHub Desktop, review the changed-file list. Commit with `CALLORIA v6.79 — mobile assessment viewport and dock safety`, then select **Push origin**.
8. Check the Vercel deployment result before treating the update as live.

## Expected behaviour

On phone-sized screens, the duplicate progress sidebar is removed from the scrolling column, leaving more room for the question and response choices. The Continue/Submit dock remains available at the bottom. Its actual rendered height and bottom offset are measured and reserved in the page, so the final response and final-review area can scroll clear of it. Short portrait screens use more compact spacing without hiding question text or answer choices.

The desktop layout, assessment question content, scoring, security-breach rules, pass thresholds and assessment draft data are unchanged. No database migration or new environment variable is required.
