# CALLORIA v7.24 — GUI Installation

## Package type

Cumulative integration overlay. It is not a complete repository replacement.

## Before replacing files

1. Open GitHub Desktop and select the existing `calloria` repository.
2. Use **Repository → Show in Explorer**.
3. Copy the repository folder to a backup location.
4. Extract this ZIP into a separate folder.

## Merge files

Copy and merge these folders from the ZIP into the repository root:

- `build/`
- `js/`
- `styles/`
- `tests/`

Merge folders; do not delete files already in the repository.

## Replace Vite configuration

Replace the repository's root `vite.config.js` with the included `vite.config.js`.

This configuration is based on the current public v7.22 configuration and adds exactly one new plugin after `calloriaDigitalExperienceSuitePluginV722()`:

`calloriaDigitalCompletionSuitePluginV724()`

Do not also register `calloriaCustomerRecoveryPlanPluginV723()` separately. The v7.24 composition plugin already invokes the v7.23 transformation. Do not register v7.15–v7.21 individually; they remain encapsulated by v7.22.

## Commit and push

Review the file list in GitHub Desktop. Commit:

`CALLORIA v7.24 — activate customer recovery and general career defaults`

Push to `main` and inspect the Vercel deployment.

## Expected build sequence

Vercel should continue using the repository's existing commands:

- Install: `npm install`
- Build: `npm run build`
- Output: `dist`

The public manifest already contains these scripts; do not replace `package.json` for this release.

## New-applicant defaults and saved profiles

Fresh applicants now default to the General Customer Experience (`service`) track, Customer Experience department and ₦170,000 starting salary. Banking, Technical Support and Sales remain selectable. Existing saved career-track choices and populated department/salary values are preserved. Older saves that do not contain department or salary receive values derived from their saved career track.

## Preserve

Do not replace or delete:

- `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`
- `.env` files or Vercel environment variables
- `vercel.json`
- `public/assets/` and all GLB/texture/audio binaries
- Any existing pages, Supabase migrations or unrelated Vite plugins

No database migration or new environment variable is required.
