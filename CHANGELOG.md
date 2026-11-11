# Changelog — CALLORIA v4.5.0

- Replaced the legacy multiple-choice outbound campaign interaction panel with a free-text, multi-turn agent/customer conversation.
- Added synthetic customer preferences for open conversation, busy, callback requested, declined and do-not-contact.
- Requires transparent agent identity, campaign purpose and permission to continue before the customer conversation proceeds.
- Added customer reactions, conversation transcript, patience, turn score and interaction QA summary.
- Added safe handling for refusal, callback request and opt-out.
- Writes a do-not-contact request into the existing suppression register as soon as it is discovered, so ending an interaction cannot bypass suppression.
- Preserved the existing shift availability gate, campaign start logic, callbacks, callback due-time guard, wrap-up, CRM cases, outbound attempts, QA, performance and career save path.
- Added campaign activity summary, callback due summary, recent attempt history and suppression-register view.
- Added outbound supervisor assistance request and customer speech playback.
- Persists conversation transcript, customer preference, permission status, callback/suppression outcome and critical breach evidence in CRM and outbound attempt records.
- Allows a review-required after-contact disposition for unresolved outbound interactions and opens a supervisor follow-up record.
- Awards product-offer sales credit only after an explicit simulated customer acceptance; a completed conversation alone is not a sale.
- Added responsive mobile styles and regression tests.
- No external dialler, telephony provider, AI provider, customer contact data or backend migration was introduced.
