# Install CALLORIA v6.48 (GitHub GUI)

This ZIP is a cumulative overlay. It includes the required v6.42–v6.47 build modules and tests, then registers v6.48 after them. It does not require separate installation of the earlier overlays in this series.

1. Download and extract `CALLORIA_v6_48_Career_Competency_Passport.zip`.
2. Open `zaksz1991/calloria` on GitHub and select the `main` branch.
3. Merge the archive's `build/` and `tests/` folders into the repository, preserving folder paths. Keep existing project build plugins that are not in the archive.
4. Replace the repository's `vite.config.js` with the archive's `vite.config.js`. It retains the existing world, OJT, shift, outbound and mobile plugins, then registers the v6.42–v6.48 integration chain.
5. Commit the changes to `main` and review the Vercel deployment result.

Do not replace `package.json`, `package-lock.json`, `.env` files, Supabase credentials, Groq keys, Supabase migrations or GLB assets. The overlay introduces no package dependency and no database migration.

## Check after deployment

1. Complete or already have an employee profile.
2. Open **Career profile**.
3. Scroll to **Career competency passport**.
4. After a human QA review creates coaching plans, check that each plan appears under the relevant competency area.
5. Complete guided practice and confirm that practice attempts increase separately from verified evidence.
6. Mark coaching delivered and record a human follow-up outcome. Only `Improvement demonstrated` moves the plan into verified evidence. A later `Further practice required` reopens it and removes it from the verified count.

The passport does not award promotion, salary, XP or KPI changes.
