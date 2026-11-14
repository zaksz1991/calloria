# CALLORIA v6.48 — Career Competency Passport

This overlay adds an evidence-based competency passport to the existing employee **Career profile**. It connects the human QA coaching cycle (v6.46) and guided practice (v6.47) to the employee's career page.

## What it displays

- Security and privacy
- Customer communication
- Ownership and resolution
- CRM and documentation
- Product and policy knowledge
- Ethical sales and cross-selling
- Service quality foundations

Each competency shows human QA coaching plans, supervisor-verified improvements, open/delivered actions, guided-practice attempts and the latest review reference.

## Evidence rules

Only a QA coaching action currently marked `verified` with the last follow-up outcome `improved` counts as verified. Guided practice, including a 100% checklist match, remains separate and does not qualify as supervisor-confirmed competence. Reopened actions are not counted as verified.

The passport is a development record. It does not award XP, change salary, alter KPIs or bypass the existing annual promotion examination and eligibility rules.

## Installation

Use the GitHub GUI installation instructions in `INSTALL-GITHUB.md`. This is a cumulative overlay: it carries the v6.42–v6.47 modules required by the replacement Vite configuration as well as the new v6.48 module.

No package dependency, database migration, Supabase setting, API key or GLB asset is changed.

## Verification boundary

The carried-forward and v6.48 focused integration suite contains 51 tests; all 51 pass. Plugin syntax, Vite configuration syntax, transformed fixture syntax and ZIP integrity are checked. The complete repository production build, live browser rendering and Vercel deployment have not been run from this environment.
