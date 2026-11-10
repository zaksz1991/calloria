# Vercel build failure analysis — 10 November 2026

Reported deployment commit: `96649f9`.

## What succeeded

- Git clone and build cache restore.
- `npm install` (24 packages; 0 vulnerabilities reported).
- Vite started and transformed 56 modules.

## What failed

The hard failure occurred in the `calloria-first-working-shift-v3-5` Vite transform:

`expected exactly one staff candidate-load loop end anchor; found 0`

This is an application build-plugin source-anchor mismatch. It is not an npm installation failure, a Vercel platform outage or a Node engine failure.

## Non-fatal messages

- The Vite v3.3 glazed-partition plugin safely skipped its optional GLB integration because its disposal anchor had changed. Existing room glass was retained. This warning did not stop the build.
- The `cache-dir` npm config warning and Node engine forward-compatibility warning did not stop dependency installation.
- The `esbuild` install-script allow-list warning was not the fatal error shown in this log; Vite reached source transformation.

## Additional anchor drift found by comparing commit 96649f9

The v3.5 plugin's `START_SHIFT_TIME_ANCHOR` and `OPEN_WORK_VIEW_ANCHOR` omit two leading spaces that exist in the corresponding `main.js` statements. The build would therefore have encountered another anchor error after the staff transform was repaired. This hotfix corrects those two anchors proactively.

## Verification boundary

The replacement plugin syntax and 12 focused regression tests pass in the patch workspace. The full repository build still requires a new Vercel run and is not claimed as passed.
