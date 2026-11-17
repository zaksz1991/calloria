# CALLORIA v6.64 — Adaptive Digital Customer Behaviour

## Purpose

Deepen the main contact-centre gameplay by making synthetic email, live-chat and social customers react to the quality of the agent's responses. Customers are no longer limited to one static scripted follow-up. The simulator now carries a per-contact customer persona, sentiment, patience and a bounded sequence of adaptive responses.

## Added

- Six deterministic customer profiles: cooperative, frustrated, uncertain, security-conscious, time-pressured and repeat complainant.
- Per-contact customer sentiment and patience values, persisted inside the existing digital contact record.
- Reply evaluation linked to the existing digital practice-quality dimensions: acknowledgement, ownership, next step and privacy, with additional persona-specific clarity/security/timing signals.
- Adaptive customer follow-up text that responds to missing acknowledgement, unclear ownership, weak next steps, privacy reassurance and repeat-complaint context.
- A three-customer-turn limit per digital contact to keep the simulation finite and playable.
- Customer mood and reaction history recorded in the existing contact timeline.
- Supervisor recommendation when customer sentiment becomes critically low or multiple replies worsen the interaction.
- Agent-side customer behaviour panel showing persona, mood, sentiment, patience, turn count and a supervisor-assistance action.
- Supervisor customer-emotion watch showing open contacts that need attention, ranked by lowest sentiment.
- Customer persona, mood, sentiment and intervention flag copied into the synthetic CRM case record at wrap-up.
- Legacy save handling: existing awaiting-customer contacts retain their already-scripted follow-up as the first pending customer turn.
- Responsive desktop and phone presentation.

## Operating flow

1. An agent accepts a synthetic email, live-chat or social contact. CALLORIA assigns a stable customer persona for that contact.
2. The agent replies using the existing secure digital composer. Existing unsafe credential/card-data checks remain in force.
3. The reply's quality dimensions update simulated customer sentiment and patience.
4. If a further customer turn is available, a persona-specific response is prepared and delivered through the existing customer-follow-up action.
5. The thread returns to the agent for another reply. After three customer follow-up turns, the contact must be completed, left pending or escalated.
6. Low sentiment or repeated deterioration appears in the supervisor's customer-emotion watch. The agent may request supervisor assistance from the contact panel.
7. Final customer behaviour values are retained in the simulated CRM case record.

## Product and data boundaries

- Customer names, messages, behaviours and outcomes are fictional local gameplay data.
- Sentiment and patience are game mechanics, not validated psychological measurements, real customer sentiment analytics or employee-monitoring scores.
- No external AI, real customer inbox, live social account, CRM provider, telephone network, notification provider or payment system is connected.
- Existing digital first-response SLA tracking, automatic digital arrivals, channel capacity, CRM, QA, supervisor queue control, recruitment, 3D workplace and career progression are retained.
- No database migration, secret, environment variable, package dependency or external provider configuration is added.
- Recruitment remains the entry gate; the primary gameplay remains real simulated agent work, contact resolution and career progression.
