# Install CALLORIA v3.7.1 with GitHub Desktop

1. Download and extract `CALLORIA_v3_7_1_AnchorRepair_Patch.zip`.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop. Confirm the checked-out branch is `main` and its current commit is `12772ea` or a later commit that still contains the v3.7 plugin.
3. Choose **Repository → Show in Explorer**.
4. Copy the two files from the extracted ZIP into the matching repository folders, replacing those exact two files:
   - `build/calloria-ojt-glb-activation-plugin.mjs`
   - `tests/calloria-v37-onboarding-glb.test.mjs`
5. Do not replace `vite.config.js`, `package.json`, `js/main.js`, `index.html`, `build/calloria-ojt-runtime.js`, earlier gameplay plugins or any assets.
6. In GitHub Desktop, review that only those two paths changed. Commit with `CALLORIA v3.7.1 — repair OJT integration anchors` and push `main`.
7. Inspect the next Vercel deployment logs. The expected result is that Vite progresses past the v3.7 OJT plugin's `acceptance anchor` step. Do not assume deployment succeeded until Vercel reports a successful production build.
