# CALLORIA v1.0.0 verification report

- Automated regression tests: 75/75 passed.
- JavaScript syntax checks: passed.
- ZIP integrity: checked after packaging.
- Vite production build: not run; project dependencies are not installed in this environment.
- Supabase migration execution: not performed.
- Live Supabase RPC/RLS and tenant-isolation tests: not performed.
- Browser, mobile and multi-device conflict testing: not performed.
- GitHub update and Vercel deployment: not performed.

The persistence layer stores synthetic game state only. It does not make CALLORIA suitable for real customer, employee-sensitive or banking data. Multi-device writes use last-write-wins snapshots; conflict-free merging is not implemented.

## Test summary

```text
issions are explicit and least-privilege definitions are available
ok 53 - role permissions are explicit and least-privilege definitions are available
  ---
  duration_ms: 0.224378
  type: 'test'
  ...
# Subtest: legacy player saves receive a default local workspace and snapshots remain tenant-scoped
ok 54 - legacy player saves receive a default local workspace and snapshots remain tenant-scoped
  ---
  duration_ms: 0.369978
  type: 'test'
  ...
# Subtest: shift state catalogue and default work schedule are coherent
ok 55 - shift state catalogue and default work schedule are coherent
  ---
  duration_ms: 1.089714
  type: 'test'
  ...
# Subtest: shift transitions record valid states and reject backward event time
ok 56 - shift transitions record valid states and reject backward event time
  ---
  duration_ms: 1.607956
  type: 'test'
  ...
# Subtest: scheduled break detection and adherence score reward matching agent states
ok 57 - scheduled break detection and adherence score reward matching agent states
  ---
  duration_ms: 0.505252
  type: 'test'
  ...
# Subtest: late start is counted as schedule deviation
ok 58 - late start is counted as schedule deviation
  ---
  duration_ms: 0.223988
  type: 'test'
  ...
# Subtest: shift closure blocks active calls and stores final adherence
ok 59 - shift closure blocks active calls and stores final adherence
  ---
  duration_ms: 0.295206
  type: 'test'
  ...
# Subtest: coaching record validates required fields and creates a bounded action plan
ok 60 - coaching record validates required fields and creates a bounded action plan
  ---
  duration_ms: 0.250037
  type: 'test'
  ...
# Subtest: shift plan rejects overlapping or out-of-window breaks
ok 61 - shift plan rejects overlapping or out-of-window breaks
  ---
  duration_ms: 0.232781
  type: 'test'
  ...
# Subtest: voice capability checks detect optional browser APIs without assuming support
ok 62 - voice capability checks detect optional browser APIs without assuming support
  ---
  duration_ms: 0.633636
  type: 'test'
  ...
# Subtest: voice session requires explicit consent and a simulated interaction reference
ok 63 - voice session requires explicit consent and a simulated interaction reference
  ---
  duration_ms: 0.802471
  type: 'test'
  ...
# Subtest: transcript sanitation redacts credentials, account details and payment-card numbers
ok 64 - transcript sanitation redacts credentials, account details and payment-card numbers
  ---
  duration_ms: 1.423187
  type: 'test'
  ...
# Subtest: transcripts append only to a consented in-memory session and are bounded
ok 65 - transcripts append only to a consented in-memory session and are bounded
  ---
  duration_ms: 0.327324
  type: 'test'
  ...
# Subtest: voice session sanitiser limits transcript length
ok 66 - voice session sanitiser limits transcript length
  ---
  duration_ms: 0.143426
  type: 'test'
  ...
# Subtest: department catalogue keeps specialist units under customer-care standards
ok 67 - department catalogue keeps specialist units under customer-care standards
  ---
  duration_ms: 0.695299
  type: 'test'
  ...
# Subtest: briefing schedule identifies morning and afternoon sessions using local time
ok 68 - briefing schedule identifies morning and afternoon sessions using local time
  ---
  duration_ms: 0.410399
  type: 'test'
  ...
# Subtest: briefing attendance is idempotent for an employee and briefing
ok 69 - briefing attendance is idempotent for an employee and briefing
  ---
  duration_ms: 0.318621
  type: 'test'
  ...
# Subtest: promotion score uses the published weighted KPI formula
ok 70 - promotion score uses the published weighted KPI formula
  ---
  duration_ms: 0.17875
  type: 'test'
  ...
# Subtest: promotion permits at most one exam per year and three attempts overall
ok 71 - promotion permits at most one exam per year and three attempts overall
  ---
  duration_ms: 0.626585
  type: 'test'
  ...
# Subtest: cross-selling records only qualified interest when relevance, eligibility and consent all hold
ok 72 - cross-selling records only qualified interest when relevance, eligibility and consent all hold
  ---
  duration_ms: 0.243627
  type: 'test'
  ...
# Subtest: commendations are routed through official review and never record private benefit acceptance
ok 73 - commendations are routed through official review and never record private benefit acceptance
  ---
  duration_ms: 0.249276
  type: 'test'
  ...
# Subtest: enterprise system events are synthetic and reject unknown systems
ok 74 - enterprise system events are synthetic and reject unknown systems
  ---
  duration_ms: 0.188394
  type: 'test'
  ...
# Subtest: People and systems workspace is reachable and existing recruitment gate remains in place
ok 75 - People and systems workspace is reachable and existing recruitment gate remains in place
  ---
  duration_ms: 9.486342
  type: 'test'
  ...
1..75
# tests 75
# suites 0
# pass 75
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 502.676026

```

## Syntax check

```text

> calloria@1.0.0 check
> node --check js/main.js && node --check js/production-world.js && node --check js/operations-engine.js && node --check js/workforce-engine.js && node --check js/shift-engine.js && node --check js/voice-engine.js && node --check js/multichannel-engine.js && node --check js/organization-engine.js && node --check js/cloud-security.js && node --check js/cloud-platform.js && node --check js/cloud-employment-sync.js


```
