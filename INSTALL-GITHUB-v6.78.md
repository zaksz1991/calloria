# CALLORIA v6.78 — GUI installation

This is an incremental updated-files package, not a complete repository replacement.

1. Download and extract `CALLORIA-v6.78-UPDATED-FILES.zip` in File Explorer.
2. Open the existing `zaksz1991/calloria` checkout through GitHub Desktop and choose **Repository → Show in Explorer**.
3. Copy the extracted `js`, `public`, `tests` and `docs` folders into the existing repository root. Allow replacement of matching files.
4. Confirm these source changes are present:
   - Replace `js/main.js`.
   - Add `js/assessment-draft-engine.js`.
   - Replace `public/calloria-mobile-responsive-v6-10.css`.
   - Replace `public/js/calloria-mobile-ui-guard-v6-10.js`.
   - Add `tests/calloria-assessment-resume-v678.test.mjs`.
   - Add `docs/CALLORIA-v6.78-ASSESSMENT-DRAFT-RESUME.md`.
5. Do not delete or replace the existing `.git` directory, `public/assets/`, GLB models, or unrelated application files.
6. In GitHub Desktop, review the changed-file list. Commit with `CALLORIA v6.78 — assessment draft save and resume`, then **Push origin**.
7. Allow the connected Vercel project to build the pushed commit. Check the deployment result before treating it as released.

## Expected behaviour

During aptitude, practical-call assessment and final review, the header includes **Save & exit**. Selecting it saves the current response set and returns to the candidate page. That page shows the saved response count, progress percentage and last-save time. **Resume assessment** returns to the exact question and section. A deliberate **Retake assessment** still starts a clean attempt.

On mobile, the bottom assessment action dock also proxies the final **Submit assessment** action on the review screen.

No Supabase migration or new environment variable is required.
