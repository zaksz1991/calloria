# CALLORIA v5.1 — Learning & Competency Academy

An additive learning-management workspace for CALLORIA. It expands the employee lifecycle from v5.0 into ongoing role-based learning, practical skill evidence, internal course certifications and the daily service/product briefing cycle.

This release does not replace any existing CALLORIA application entry point, Vite configuration, recruitment flow, OJT flow, GLB asset, 3D workplace or game system.

## Included

- Course catalogue with 11 structured learning modules covering general customer experience, verification and data care, CRM/case records, voice, digital channels, complaint recovery, QA calibration, workforce operations, systems support/cyber hygiene, team coaching and knowledge management.
- Role-aware assignment to one employee or supported department groups. Duplicate open assignments are blocked; unsupported role-specific bulk assignments are rejected.
- Lesson completion tracking. An assessment is locked until every lesson is marked complete.
- Three-question knowledge checks, an 80% pass mark, attempt history, failed-course reset and explicit retake flow.
- Internal course certification with a 365-day validity period and renewal/expiry status calculation.
- Automatic course-linked competency evidence for every skill mapped to a passed course.
- Manual manager/trainer competency assessments with required observable evidence and assessor identity.
- Employee skill matrix showing the latest recorded outcome for each competency.
- Morning 7:30 AM and afternoon 2:00 PM team briefing scheduling, topic/audience/trainer, change summary and attendance records.
- Duplicate briefing slot and duplicate attendee controls.
- Dashboard, overdue queue, completion/renewal metrics, recent activity and CSV training report.
- Explicit one-way employee snapshot import from People Operations v5.0 when both pages use the same browser and origin. First initialisation also reads that snapshot when available.
- Links back to People Operations, Performance & Career and Supervisor & QA pages.

## Installation

This is an additive public-folder overlay, not a full repository snapshot.

1. Extract the ZIP.
2. Open `CALLORIA_v5_1_Learning_Competency_Academy/public`.
3. Copy these four files into the existing CALLORIA repository `public` folder:
   - `learning-academy.html`
   - `learning-academy.css`
   - `learning-academy.js`
   - `learning-academy-engine.js`
4. Keep all existing files. Do not replace `vite.config.js`, `main.js`, game entry points, OJT files, protected assets or other modules.
5. Deploy using the repository's normal process.

The expected page route after deployment is `/learning-academy.html`, e.g. `https://calloria.vercel.app/learning-academy.html`.

## Employee import

The module reads `calloria.people-operations.v50`. If People Operations v5.0 is already saved in the same browser and origin when the academy is first opened, its employee profiles are used as the starting roster. Otherwise, a synthetic roster is created.

Use **Import v5.0 employees** to refresh the academy's employee snapshot deliberately. Import is one-way: it updates the academy roster only. Training assignments, results, competencies and briefings do not write back to People Operations. There is no automatic sync or cross-device sync.

## Data and operational boundaries

- Demo content and employee records are synthetic. Course material is illustrative operational training content, not a legal, regulatory or policy certification.
- All academy records use the current browser's `localStorage`. Records are not shared between browsers, devices or users and may be lost when browser storage is cleared.
- This is not an authenticated LMS or HR platform. It has no real tenant isolation, learner/manager/trainer permissions, secure server-side audit trail, backup, encryption-at-rest guarantee, central database, SCORM/xAPI support, live virtual classroom or actual notification delivery.
- The course certifications are internal demonstration records. They are not accredited qualifications, professional licences or proof of regulatory compliance.
- Marking a lesson complete is a learner action in this simulation. Practical workplace capability still requires human observation and sign-off. Course pass results create evidence for mapped skills, but do not replace supervisory assessment.
- Competency assessments are only as reliable as the entered evidence and assessor. Use synthetic case references; do not enter real customer personal information.
- Briefing attendance is manually recorded. The module does not send calendar invitations, push notifications or automatically connect to shifts or rosters.
- Do not enter confidential employee, customer, health or security information into this demonstration build.

## Package layout

- `public/learning-academy.html` — page shell.
- `public/learning-academy.css` — responsive workspace styles.
- `public/learning-academy.js` — page interactions and rendering.
- `public/learning-academy-engine.js` — course, competency, briefing, import and persistence logic.
- `tests/learning-academy-v51.test.mjs` — focused unit and static integration tests.
- `CHANGELOG.md` — release summary.
- `VERIFICATION.md` — checks performed and unverified areas.
