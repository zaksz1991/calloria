# Build diagnosis — commit c8a48d6

## Fatal error

The Vercel build fails in `calloria-ruffneck-service-operations-v6-86` while transforming `js/main.js`:

`source rebase failed: applicant default track, applicant default department, Workforce systems directory insertion point`

## Cause

The v6.86 plugin treated all three strings as mandatory. The first two are presentation defaults and may already have been rewritten by an earlier transform. They are not required for the RuffNeck support UI, scoring, CRM mirror or case workflow to work.

The old UI insertion key also included an adjacent closing `</div>` sequence. That markup detail is brittle: the actual Workforce view is assembled inside a template literal and the system activity heading is the more stable insertion point.

## Repair

1. Track and department default replacements now run only when exactly one old literal remains. Zero matches are treated as already handled and logged as a warning; more than one remains an error.
2. The support panel is inserted before `<h4 style="margin-top:16px">System activity</h4>`.
3. All substantive event, CRM, migration and renderer anchors remain exact-one checks.

## Verification boundary

The test suite exercises both the original v6.86-style fixture and a source-drift fixture where the applicant defaults have already been changed and the old wrapper-based insertion context is absent. Full `npm run build`, Vercel deployment and on-device browser tests require the complete live repository and were not run in this isolated overlay.
