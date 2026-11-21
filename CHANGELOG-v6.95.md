# CALLORIA v6.95 — SLA clock integrity

## Fixed

- Corrected the `pending_customer` follow-up due-time calculation.
- The prior implementation calculated a day using `current simulated minute + 1,440`, then forced the deadline clock to 10:00 independently. On late-day outcomes, the stored day and clock could represent more than 24 hours of delay.
- v6.95 now sets the deadline to 10:00 on the next simulated day in one consistent operation.
- Ensured the returned due object, persisted follow-up fields and history event share the same due day and minute.

## Carried forward

- Includes the v6.94 transactional customer-confirmation guard for agent and supervisor case closure.
- The composition is marker-aware and idempotent if the standalone v6.94 plugin is also registered.

## Not changed

- Urgent and normal initial reopen SLAs (30 and 120 simulated minutes).
- Supervisor review and independent reviewer requirement.
- Case status names, lifecycle state shape, data storage, customer records or external systems.
- No database migration, new dependency, or production API call.
