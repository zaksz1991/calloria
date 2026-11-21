# CALLORIA v6.93 — Customer 360 recovery intelligence

## Operational upgrade

Adds a compact Customer Recovery Brief to the existing Customer 360 continuity panel. It turns previously recorded metadata into practical agent guidance:

- Repeat contacts within 24 hours.
- Recent channel changes across a 72-hour window.
- Explicitly open follow-ups.
- Low recorded sentiment.
- Low recorded QA evidence.
- A bounded customer-effort signal and prioritised handling steps.

The brief is read-only. It does not create, assign, transfer, escalate, resolve or close customer work.

## Data-quality repairs

- Repeat-customer status now requires more than one recorded interaction.
- Only explicit open-work statuses count as open follow-ups; generic `Recorded` history no longer inflates open-work counts.
- `Resolved`, `Completed`, `Closed`, `Declined`, `Suppressed`, opt-out and no-further-action outcomes are closed even when their text also contains callback/follow-up language.
- Missing QA and sentiment values remain unknown (`null`) instead of being coerced to `0` during state normalisation.
- Older continuity saves are normalised without dropping retained interactions.

## Scope

No new dependencies, database migration, Supabase write, API call, live-customer-data access or environment variable. Existing continuity metadata remains synthetic local gameplay data.
