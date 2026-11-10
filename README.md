# CALLORIA v4.2.0 — Supervised Contact Practice

This cumulative OJT runtime includes the v4.1 interactive agent-shadowing journey and upgrades Module 04 into a multi-turn supervised customer interaction. It is designed for a multi-industry contact-centre employee, not a bank-only agent.

## What changes

- Trainees respond to a synthetic customer over multiple conversational turns.
- The customer asks for ownership and continuity from a previous interaction.
- The trainee opens the simulated customer/service record, previous interaction history and current approved knowledge article.
- The trainee explains an evidence-based next step without inventing resolution or deadlines.
- The trainee completes a training-only CRM/case record with reason, actions, owner and customer update route.
- A deterministic trainer rubric gives feedback and scores four competencies: opening, investigation, next-step explanation and wrap-up. Each is worth 25 points.
- Unsafe credential solicitation and unsupported guarantees trigger coaching and prevent progression.
- Practice evidence stays in the employee onboarding profile. It does not create production cases or update live calls handled, AHT, QA, CSAT, adherence, salary or incentives.
- Existing completed onboarding profiles are preserved without forced retraining.

## Industry scenarios

General customer experience is the default. Training scenarios cover banking, telecommunications, retail, utilities, logistics, travel, insurance, non-clinical healthcare administration, technology/SaaS and public-service information.

## Files

- `build/calloria-ojt-runtime.js` — complete cumulative replacement runtime. Includes the v4.1 shadowing flow plus v4.2 supervised conversation.
- `tests/calloria-v42-supervised-contact-practice.test.mjs` — isolated state-machine and integration-contract regression tests.

No new Vite plugin or package dependency is required. The existing v3.8.2 OJT/GLB plugin reads this runtime at build time.
