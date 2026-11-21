# CALLORIA v6.87 — RuffNeck source-rebase hotfix

**Repository:** `zaksz1991/calloria`  
**Failing deployment:** commit `c8a48d6`  
**Release type:** cumulative targeted overlay, not a full repository export.

## Purpose

The supplied Vercel log shows that the v6.86 RuffNeck transform aborts while rebasing `js/main.js`. The failure groups three assumptions: exact applicant default literals and the old Workforce system-activity insertion wrapper.

v6.87 repairs those assumptions without weakening checks for the actual operational features:

- Applicant track and department defaults are optional transform anchors. If an earlier plugin already changed those values, v6.87 leaves them alone. Duplicate occurrences still fail closed.
- The Workforce operations panel is inserted immediately before the stable `System activity` heading. It no longer relies on an adjacent closing `</div>` wrapper.
- Critical state migration, Workforce renderer, system launch, click handler, CRM, and sandbox anchors remain strict. Ambiguous or missing functional anchors still stop the transform rather than emit partial gameplay code.
- The v6.86 catalogue, synthetic case workflow, routing, SLA rules and practice scoring are retained.
- v6.84 non-blocking GLB startup and v6.85 third-person repair are carried forward.

## Runtime scope

This patch only changes CALLORIA's build-time integration. It does not contact RuffNeck production applications, make real customer-system changes, add Supabase migrations, or add secrets.
