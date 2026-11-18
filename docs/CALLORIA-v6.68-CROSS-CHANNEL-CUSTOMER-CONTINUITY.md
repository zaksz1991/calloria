# CALLORIA v6.68 — Cross-channel Customer Continuity

## Delivered

- Added a shared local customer-continuity registry for the live simulator.
- Inbound voice, outbound voice, email, live chat and social interactions append compact case metadata to a customer history after after-contact work is saved.
- The live inbound, outbound and digital agent workspaces display previous channels, recent interaction references, the latest contact and open follow-up states before the agent continues handling the customer.
- Existing local saves migrate by normalising the new registry; earlier interaction/case data remains intact.
- Customer matching uses a shared synthetic customer reference when available and otherwise falls back to a normalised display-name match. The interface labels this match basis and explicitly does not claim real-world identity verification.
- Continuity stores references, channel, direction, issue title, status, disposition, timestamp and optional QA/sentiment values only. It does not copy free-form wrap-up notes or conversation transcripts into the continuity registry.
- Each customer history is bounded to the most recent 20 interactions; the registry is bounded to 500 profiles.

## Verification scope

- New v6.68 engine tests cover stable identity matching, cross-channel history, open follow-ups, duplicate prevention, sanitisation, limits, migration and metrics.
- New v6.68 UI contract tests check that the live inbound, outbound and digital workspaces render the continuity panel and that all three channel paths record completed work.
- `npm run check` validates JavaScript syntax. The Vite production build and deployed browser walkthrough must still be run against the complete repository.

## Simulation boundary

All customer histories and records are fictional local gameplay data. Name-based matching is a convenience for the simulation, not proof that two real people are the same person. No real customer database or external CRM is connected by this feature.
