# Install CALLORIA v3.8.1 using GitHub Desktop

1. Download and extract this ZIP in File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop and choose **Repository → Show in Explorer**.
3. Open the extracted `CALLORIA_v3_8_1_Runtime_Decoder_Repair` folder.
4. Copy its `build/calloria-ojt-glb-activation-plugin.mjs` into the repository's `build` folder, replacing that exact file.
5. Copy its `tests/calloria-v37-onboarding-glb.test.mjs` into the repository's `tests` folder, replacing that exact file.
6. Do not copy the outer folder into the repository, and do not replace other project files.
7. Return to GitHub Desktop. Review that only the two files above changed.
8. Commit with: `CALLORIA v3.8.1 — repair real GLB decoder wiring`.
9. Push to `main` and inspect the Vercel deployment log.

No SQL migration, environment variable, secret, or external decoder download is required.
