# CALLORIA v4.3.0 — Trainer Sign-off, Workstation Allocation & First Shift

## Purpose

This is a cumulative OJT runtime release. It carries forward the v4.1 interactive agent-shadowing flow and v4.2 multi-turn supervised contact practice, then replaces the earlier one-click sign-off with a staged trainer-review and workstation-allocation process.

Recruitment remains the employment entry gate. On-the-job training takes place after the employment offer and before independent customer work. The default training pack is General Customer Experience; banking remains one optional industry pack.

## What changes

1. **Evidence-based trainer review.** The trainee must complete product/service knowledge, CRM logging, experienced-agent shadowing and supervised contact practice. The simulated trainer reviews those four records and must attest to evidence, customer-care readiness, safe conduct and system use.
2. **Separate approval and allocation stages.** Approval does not immediately unlock a shift. The employee must select an operating department and one of twelve workstation positions.
3. **Universal customer-care foundation.** Every department retains customer-care responsibility. The allocation record stores a department-specific skill plus the universal customer-care rotation requirement and voice, email and live-chat channel capability.
4. **Briefing-gated first shift.** Newly onboarded employees cannot start their independent shift until a workstation is allocated and attendance at the applicable 07:30 morning or 14:00 afternoon briefing is recorded.
5. **First-shift evidence.** After the existing shift engine actually activates the shift, CALLORIA records the first independent working-shift event against the assigned workstation. It does not invent completed calls or performance results.
6. **Compatibility migration.** v4.2 employees who completed training through the previous one-click sign-off but have not yet worked are moved directly to workstation allocation. Employees with prior production work keep their existing access and are grandfathered.
7. **Training / production separation.** OJT evidence remains training-only. It does not add calls handled, cases, QA, CSAT, AHT, adherence, salary or incentives.

## Included files

- `build/calloria-ojt-runtime.js` — complete cumulative replacement runtime containing v4.1, v4.2 and v4.3 OJT flows.
- `tests/calloria-v42-supervised-contact-practice.test.mjs` — retained v4.2 regression suite.
- `tests/calloria-v43-trainer-signoff-allocation.test.mjs` — v4.3 trainer, workstation, briefing and migration tests.
- `INSTALL-GITHUB.md` — graphical GitHub Desktop installation instructions.
- `CHANGELOG.md` — release notes.
- `VERIFICATION.md` — exact test results and verification limits.

## Important verification boundary

The trainer named in the workflow is an in-game simulated trainer. This patch does not connect to a real human manager or external HR platform. Workstation positions are simulated assignments in the employee save; they do not prove that a matching physical GLB desk is correctly rendered in the 3D world. The first shift uses CALLORIA's existing simulated shift and contact queues.

The package tests pass in isolation. A full repository `npm test`, Vite production build, Vercel deployment, live browser session and 3D GLB rendering have not been verified by this package.
