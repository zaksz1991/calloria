# Install CALLORIA v6.47 (GitHub GUI)

1. Download and extract `CALLORIA_v6_47_Guided_Coaching_Practice.zip`.
2. Open `zaksz1991/calloria` on GitHub and select the `main` branch.
3. Merge the archive's `build/` and `tests/` contents into the repository, preserving the folder paths. Do not delete existing project files.
4. Replace the repository's `vite.config.js` with the one in this archive. It preserves the previously supplied v6.42–v6.46 plugin chain and registers v6.47 after v6.46.
5. Commit the changes to `main` and allow Vercel to run the deployment build.

Do not replace `package.json`, `package-lock.json`, `.env` files, Supabase credentials, Groq keys, Supabase migrations or GLB assets. This feature adds no package dependency and no database migration.

The archive carries forward its required v6.42–v6.46 plugin modules. Keep the original project files under `build/` that are not present in the overlay.

## Check the feature after deployment

1. Complete an inbound contact and save it.
2. Open Quality Assurance → Human QA & calibration and complete a human review with a low-rated criterion or mandatory compliance flag.
3. Open the generated action in **QA coaching follow-through**.
4. Select **Launch guided practice**. Enter a response to the displayed customer scenario and choose **Check practice response**.
5. Review the checklist feedback and, where necessary, practise again.
6. Use the existing supervisor workflow to record coaching delivery and later enter real follow-up evidence. Practice feedback alone does not verify or close the action.
