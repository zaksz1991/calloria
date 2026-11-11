# CALLORIA v5.2 — Knowledge & Product Operations

An additive service-knowledge workspace for CALLORIA. It adds controlled knowledge authoring, product/service reference records, article-use logging and operational change notices. It gives the service simulator a maintained knowledge workflow instead of treating knowledge management as training-course content alone.

## Included

- Knowledge library with full-text search across titles, summaries, categories, keywords and procedural steps.
- Filters by article status, product/service and category.
- Fifteen starter articles covering customer discovery, verification, CRM records, voice, digital channels, complaint recovery, life and personal-development enquiries, relevant service discovery, RuffNeck product support and Kano game support.
- Six RuffNeck product records: RuffNeck LMS, RuffNeck Prospector, RuffNeck Connect, RuffNeck Social Hub, Kano Run and Kano Keke. Product pages link to their known public sites and list first-line support topics and relevant related services.
- Multi-industry service context with General Customer Experience as the default and banking as one optional pack.
- Life, relationship, parenting, habits, emotional-intelligence and personal-development enquiry guidance with clear non-clinical boundaries and escalation reminders.
- Knowledge article authoring with required title, summary, category and procedural steps.
- Controlled article lifecycle: Draft → In Review → Published, or Changes Requested → Draft. Only published, non-expired articles appear in published-only search and can be recorded as used.
- Article revision history retained locally; editing a published item moves its current record back to Draft for review.
- Article usage record with channel, optional case reference, employee and outcome. Usage counters feed the overview dashboard.
- Service notice authoring, severity, audience, effective date and manual publication.
- Manual one-way briefing import from Learning & Competency Academy v5.1 using `calloria.learning-academy.v51`. Cancelled sessions are skipped and previously imported briefing IDs are not duplicated.
- Article register CSV export, recent activity and stale/expired content reminders.
- Responsive page layout for desktop and mobile widths.

## Installation

This is an additive public-folder overlay, not a full CALLORIA repository snapshot.

1. Extract the ZIP.
2. Open `CALLORIA_v5_2_Knowledge_Product_Operations/public`.
3. Copy these four files into the existing CALLORIA repository `public` folder:
   - `knowledge-operations.html`
   - `knowledge-operations.css`
   - `knowledge-operations.js`
   - `knowledge-operations-engine.js`
4. Keep all existing files. Do not replace `vite.config.js`, `main.js`, game entry points, OJT files, GLB assets or any earlier module.
5. Deploy through the repository's existing deployment process.

Expected route after deployment: `/knowledge-operations.html`, for example `https://calloria.vercel.app/knowledge-operations.html`.

## Learning Academy briefing import

The **Import v5.1 briefings** control reads the `calloria.learning-academy.v51` browser-local record and imports non-cancelled sessions as published service notices. It is a one-way snapshot import. The source briefing is not modified, and changes made after import are not automatically synchronised. Both pages must have been opened in the same browser profile and same origin for their `localStorage` data to be shared.

## Product and service reference boundaries

The six RuffNeck service names and public sites are seeded as catalogue references. This module does not connect to those live products, retrieve their current features, check outages, access customer accounts, verify support routes or query service telemetry. The text articles are starter guidance for the simulation and must be checked against current approved product documentation before use in a real service operation.

Kano player counts, total sessions, sponsorship inventory, advertising rates, impressions and campaign performance are not available through this module. Agents must not invent or quote those figures without an approved, current source. Service recommendations should be relevant to the customer's stated need and must not displace resolution of the primary request.

The life and personal-development content supports respectful information handling only. It is not a clinical, therapy, legal or emergency service. The simulator content directs urgent or safety-critical issues to the organisation's approved escalation procedure.

## Data and integration boundaries

- All article, notice, usage and activity records are stored in the current browser's `localStorage` under `calloria.knowledge-operations.v52`.
- Data is not shared across devices, browsers or users. Clearing browser storage can erase it.
- This is not a secured multi-user knowledge-management system. It has no authenticated author/reviewer roles, tenant isolation, server-side audit trail, backup guarantee, access-control enforcement, notification delivery, approval delegation or central database.
- The review workflow is an operational simulation; a browser-local reviewer name is not proof of independent approval.
- The module is not yet connected to CALLORIA's central CRM, agent workstation, customer-care queues, live case records or actual service-status systems. Article use is manually recorded in this page.
- Do not enter real customer credentials, payment data, confidential customer details or sensitive employee information.

## Package layout

- `public/knowledge-operations.html` — page shell.
- `public/knowledge-operations.css` — responsive styling.
- `public/knowledge-operations.js` — page rendering and interactions.
- `public/knowledge-operations-engine.js` — data model, knowledge lifecycle, notices, import and persistence.
- `tests/knowledge-operations-v52.test.mjs` — focused unit and page-contract tests.
- `CHANGELOG.md` — release summary.
- `VERIFICATION.md` — checks performed and unverified areas.
