# Install CALLORIA v6.49 (GitHub GUI)

This is a cumulative overlay. It includes the required v6.42–v6.49 build modules and focused tests. Install it as one package; do not stack it with separate older overlay ZIPs.

1. Download and extract `CALLORIA_v6_49_Promotion_Readiness_Dossier.zip`.
2. Open `zaksz1991/calloria` on GitHub and select the `main` branch.
3. Upload/merge the archive's `build/` and `tests/` folders, preserving their directory paths. Keep existing project files that are not included in the archive.
4. Replace the repository's `vite.config.js` with the one in the archive. It preserves the existing world, GLB, OJT, shift, outbound and mobile plugins, then registers the v6.42–v6.49 integration chain.
5. Commit the changes to `main` and inspect the Vercel deployment result.

Do not replace `package.json`, `package-lock.json`, `.env` files, Supabase credentials, Groq keys, Supabase migrations or GLB assets. The overlay adds no dependency and no database migration.

## Check after deployment

1. Enter the game as an employee and open **Career**.
2. Find **Promotion readiness dossier** below the Career competency passport.
3. Complete customer contacts and recorded QA activity; the six dimensions should update from the same state used by Workforce.
4. Compare the weighted score and threshold with the Workforce promotion panel.
5. Confirm the annual-attempt balance changes only after the existing Workforce examination flow records an attempt.

The dossier cannot submit an examination or grant a promotion. Those remain governed by the existing Workforce flow and policy.
