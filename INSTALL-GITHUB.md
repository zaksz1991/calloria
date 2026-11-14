# Install CALLORIA v6.46 (GitHub GUI)

1. Download and extract `CALLORIA_v6_46_QA_Coaching_Followthrough.zip`.
2. Open `zaksz1991/calloria` on GitHub and select the `main` branch.
3. Add/merge the files from this overlay, preserving the `build/` and `tests/` folder paths.
4. Replace the repository's `vite.config.js` with the one in this overlay. It retains the v6.45 plugin chain and registers v6.46 after the inbound QA review bridge.
5. Commit the changes to `main` and allow Vercel to build the commit.

Do not upload or replace `package.json`, `package-lock.json`, `.env` files, Supabase credentials, Groq keys, or GLB assets. This patch adds no package dependency or database migration. Keep the existing v6.42–v6.45 modules in `build/`; the archive carries these required integration files as well.

## Test the feature after deployment

1. Complete and save an inbound contact.
2. Open Quality Assurance → Human QA & calibration.
3. Select the completed interaction and save a human scorecard review with one or more low-rated criteria (0–3), or review an interaction marked for mandatory compliance review.
4. Confirm the review creates linked action plans in **QA coaching follow-through**.
5. Select **Mark coaching delivered** after a coaching session has actually taken place.
6. Enter the result of a practice check. “Improvement demonstrated” marks the plan verified; “Further practice required” reopens it.

The register uses CALLORIA's existing local save/cloud-employment snapshot behaviour. It is a simulated workflow, not a server-enforced supervisor approval system or a production HR record.
