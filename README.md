# CALLORIA Phase 10 — Performance, QA & Career Progression

**Purpose:** Add an evidence-backed performance and career workspace to the Phase 9 Workforce Control baseline.

**New staff page:** `/performance`  
**New Supabase Edge Function:** `calloria-performance`  
**New database migration:** `202611070011_calloria_performance_career.sql`

This is an integration overlay for a repository that already contains CALLORIA Phases 1–9. It is not a standalone replacement for the complete game or an instruction to replace the existing root application wholesale.

## What it adds

### Monthly performance management

- Role-specific scorecards for voice, email, social/community, sales, technical support, QA, supervisors, safeguarding, learning advisers and back-office specialists.
- KPI values are entered as normalised 0–100 attainment scores against CALLORIA-approved targets.
- Every metric requires a sample count and a named evidence source before a scorecard can be submitted.
- A monthly scorecard is submitted by a permitted supervisor/People Operations account and reviewed by a second authorised manager. A manager cannot author or review their own scorecard.
- Employees can see their own scorecards, manager feedback, submit a review response and manage assigned coaching actions.
- The app does not invent missing metrics or turn absent source data into zero scores.

### Balanced KPI framework

The weight totals for each profile are validated by tests. Voice profile weights are:

| KPI | Weight |
|---|---:|
| Quality assurance | 25% |
| Security and policy compliance | 20% |
| Customer satisfaction | 15% |
| First-contact resolution | 10% |
| Schedule adherence | 10% |
| AHT target balance | 5% |
| After-contact work completion and accuracy | 5% |
| Correct escalation and handover | 5% |
| Disposition and documentation | 5% |

Other profiles use role-specific measures such as response SLA, technical resolution quality, product suitability, appropriate conversion, calibration accuracy, coaching effectiveness, safeguarding compliance and team development. Speed-related measures are deliberately low-weight and quality-gated. A short handling time cannot compensate for poor customer outcomes, non-compliance or a critical failure.

### Quality assurance

A seven-part QA rubric assesses privacy/authorised handling, accuracy, needs analysis, resolution, empathy, suitability/consent and documentation. Minimum gates apply to privacy, accuracy and suitability. A verified critical failure makes the result fail regardless of the numerical average. The evaluator must record a reason for a critical failure.

QA records store a short interaction reference, rubric values and proportionate evaluator notes. Do not enter recordings, transcripts, passwords, OTPs, payment card details or unrelated personal/medical narratives.

### Coaching and development

- Managers can assign a specific development action and due date.
- Employees can mark actions in progress or completed.
- Completed actions and employee review responses are retained for continuity.
- Feedback is kept separate from customer case records.

### Annual promotion assessments

The promotion workflow uses explicit career ladders. Each staff access record has both a `jobProfile` (which controls KPI weights) and a `careerTitle` (the employee's current career step).

Promotion exam prerequisites:

1. At least three reviewed monthly scorecards in the preceding six months.
2. Each of those three scorecards must score at least 80 and pass every quality/compliance gate.
3. The average of the three reviewed scores must be at least 80.
4. A 12-question, 30-minute scenario exam must be passed at 80% or higher.
5. One attempt per target role per calendar year, with a maximum of three attempts across the original three-year exam window. Once a target is passed, no further attempt for that target is allowed.
6. Passing the exam does not automatically promote an employee. Management must still confirm role vacancy, conduct, required training, competency and formal approval.

After a promotion is formally approved, People Operations updates that employee's `careerTitle` in the separate `CALLORIA_PERFORMANCE_ACCESS` secret to the approved next ladder step. The `jobProfile` stays the scorecard template unless the employee moves to a different function. CALLORIA does not silently change staff permissions or pay.

The exam answer key is held in the Edge Function, not sent to the browser. Answers are graded server-side. Questions are customer-care fundamentals because all CALLORIA departments must understand customer-care, privacy and safe service.

## Installation — integrate with Phase 9

Use this package on the Phase 9-integrated project. Preserve the current repository's game files and any later changes.

### Add these files

| Package file | Repository destination | Action |
|---|---|---|
| `performance.html` | `performance.html` | Add |
| `js/performance-engine.js` | same path | Add |
| `js/performance-workbench.js` | same path | Add |
| `styles/performance.css` | same path | Add |
| `supabase/functions/calloria-performance/index.ts` | same path | Add and deploy |
| `supabase/functions/calloria-performance/deno-globals.d.ts` | same path | Add; static type-check support |
| `supabase/migrations/202611070011_calloria_performance_career.sql` | `supabase/migrations/` | Add and apply once |
| `tests/performance-engine.test.mjs` | `tests/` | Add |
| `tests/performance-ui.test.mjs` | `tests/` | Add |

### Replace these Phase 9 files with the included merged versions

- `vite.config.js` — adds the Performance page to the existing multi-page build inputs while retaining the six earlier entry points and build settings.
- `package.json` — preserves the Phase 9 dependencies/scripts and adds checks for the new modules.
- `supabase/config.toml` — retains the earlier AI, telemetry and Phase 5–9 function settings and adds `calloria-performance`.
- `tsconfig.edge.json` — retains the Phase 8/9 function check paths and adds Performance.
- `agent-desk.html` and `workforce.html` — same Phase 9 pages with a Performance & Career navigation link.
- `js/agent-desk-workbench.js` — includes the apostrophe syntax correction from the earlier Vercel build failure. This file is included to prevent accidentally restoring the known faulty version.

Do not replace `index.html`, `main.js`, `game.js`, `renderer3d.js`, `production-world.js`, existing career/shift engines, knowledge files, customer-care, case-desk, CRM or earlier database migrations with files from this package. No game engine or customer operations code is removed.

## Supabase setup

1. Confirm migrations `001`–`010` are already applied before applying Phase 10. Do not rerun them.
2. Check migration history for `202611070011_calloria_performance_career.sql`. Apply migration 011 exactly once if it is not already recorded as applied.
3. Deploy the `calloria-performance` Edge Function.
4. Set the function's `verify_jwt = false` in the supplied consolidated `supabase/config.toml`. The Edge Function independently validates the bearer token using `admin.auth.getUser(token)` and then checks the separate performance access map. Do not remove either check.
5. In **Supabase → Edge Functions → Secrets**, configure:
   - `CALLORIA_ALLOWED_ORIGINS` — exact allowed origins, including `https://calloria.vercel.app` and only the localhost origins actually used.
   - `CALLORIA_PERFORMANCE_ACCESS` — a JSON map of existing Supabase Auth UUIDs to role, department scope, KPI profile and current career title.

Example structure only. Replace every placeholder with an existing employee Auth UUID and the exact permitted departments:

```json
{
  "<existing-people-admin-auth-uuid>": {
    "role": "people_admin",
    "departments": ["*"],
    "jobProfile": "supervisor",
    "careerTitle": "customer_operations_supervisor"
  },
  "<existing-supervisor-auth-uuid>": {
    "role": "supervisor",
    "departments": ["RuffNeck Products and Platform Support", "Sales and Service Enquiries"],
    "jobProfile": "supervisor",
    "careerTitle": "customer_operations_supervisor"
  },
  "<existing-sales-agent-auth-uuid>": {
    "role": "agent",
    "departments": ["Sales and Service Enquiries"],
    "jobProfile": "sales_advisor",
    "careerTitle": "sales_service_advisor"
  },
  "<existing-qa-auth-uuid>": {
    "role": "qa",
    "departments": ["Quality Assurance and Customer Experience"],
    "jobProfile": "qa_analyst",
    "careerTitle": "qa_analyst"
  }
}
```

Allowed permission roles are `agent`, `supervisor`, `qa` and `people_admin`. A `people_admin` grant must include `departments: ["*"]`. Agents must have explicit department grants. The `jobProfile` must match one of the KPI templates. The `careerTitle` must match a step in that profile's career ladder. Use real UUIDs already present in Supabase Auth; do not invent IDs or expose the secret in Vercel/browser variables.

The function uses Supabase's server-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not copy the service-role key to the browser, Vercel public environment or this repository. This phase does not read or change the existing Groq key.

## Important operational boundaries

- KPI sample counts and evidence source names are entered by an authorised manager. Live telephony, CRM, CSAT vendor, email, social, WhatsApp or workforce metric ingestion is not connected in this phase. Verify source reports before entering scores; do not fabricate data.
- Schedule adherence is not used by itself to determine quality, discipline or promotion.
- There is no automatic salary adjustment, payroll export, disciplinary automation or automatic role-permission upgrade.
- Career title changes after approval are made in the restricted Edge Function secret; the app does not grant itself new access based on an exam result.
- Employee feedback and coaching should be factual, specific, accessible and non-discriminatory.
- Customer interaction references are identifiers only. Do not put customer names, health details or full case narratives into QA or performance notes.
- The personal-guidance/customer-care department must not be judged on clinical diagnosis or treatment outcomes. Staff must follow safeguarding and qualified-human escalation boundaries.

## Build and test notes

The package retains Phase 9's Vite multi-page build configuration and adds `performance.html` as another entry. The full application Vite build still requires the complete Phase 9 root repository and all earlier installed modules; this overlay workspace is not a complete application checkout.
