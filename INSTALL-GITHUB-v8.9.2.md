# CALLORIA v8.9.2 — GUI Installation

Target repository: `zaksz1991/calloria`  
Branch: `main`  
Production: `https://calloria.vercel.app`

## Apply this repair

1. Download and extract `CALLORIA-v8.9.2-VERCEL-CLOUD-HEALTH-PACKAGE-REPAIR-UPDATED-FILES.zip`.
2. Open the existing repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Copy the contents of `CALLORIA-v8.9.2-UPDATED-FILES` into the repository root.
5. Replace only `package.json`; add the included test and documentation files.
6. Do not delete `.git`, `public/assets/`, GLB files, `.env`, any Supabase configuration, or other existing project files.
7. Review the changed-file list. Confirm that `package.json` retains the exact `prebuild` and `check` scripts and now contains `verify:workforce-cloud-health` with the required exact command.
8. Commit to `main` and push. Allow the existing Vercel project to build the commit.

## Why this patch is required

The `1a71ee7` deployment got through `npm install`, build preflight and navigation integrity. The central v8 integration audit then failed on one item only: the v8.6 read-only cloud-health regression script was missing from `package.json`.

The exact required entry is:

`"verify:workforce-cloud-health": "node --test tests/workforce-trend-cloud-health-v806.test.mjs"`

## Scope

- Replaces `package.json` only.
- Adds a local package-contract regression test and release notes.
- Adds no dependencies, migrations, Edge Functions, environment variables or secrets.
- Does not change the prebuild/check hook contract.

The next Vercel run must confirm the full v8 integration audit and `vite build`; this overlay has not been deployed or tested against the live Supabase project.
