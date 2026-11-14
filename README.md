# CALLORIA v6.51 — RuffNeck Platform Support Directory

This cumulative overlay adds a visible product-support directory to the Workforce screen and corrects the default recruitment track. It is intended to replace the currently deployed Workforce systems sandbox with a multi-service RuffNeck support workspace.

## Included services

RuffNeck LMS, Prospector, Connect, Social Hub, Kano Run and Kano Keke each receive a live service link, customer request catalogue, self-service checks, agent handling workflow, escalation criteria, relevant cross-service recommendation guidance and one interactive practice scenario. The practice records only the selected response, score and rationale. It does not alter employee KPIs, QA marks, salary, XP or promotion status.

The existing ICC, CRM, optional banking tools, JIRA and FCQA entries remain available. Finacle is removed from the simulated systems list. Existing Finacle event entries in older browser saves are filtered out of the visible activity list, not deleted.

## General customer-experience default

New candidates now start on the General Customer Experience track. A legacy profile is changed only when it is still an empty, unsubmitted applicant using the old untouched Banking Operations default. Submitted applications and explicit track selections are preserved. Banking remains an optional recruitment track.

## Cumulative installation

Merge the included `build/`, `tests/` and configuration files into the repository. Replace `vite.config.js` with the included cumulative config. It registers the existing v6.42–v6.50 build plugins and the new v6.51 plugin in sequence. Do not replace `package.json`, `package-lock.json`, `public/assets/models`, Supabase settings or environment variables.

The package does not include the full application source or GLB assets. External service links open the existing RuffNeck sites in a separate browser tab; this simulator does not read their account data or authenticate users into them.
