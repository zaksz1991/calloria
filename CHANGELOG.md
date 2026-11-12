# CALLORIA v6.3 — Office Routine Gameplay

## Added
- Physical 3D staff activity points for Reception, Team Briefing Room, Staff Lounge and Supervisor Hub.
- Reception clock-in with employee name and assigned team; new shifts require a matching check-in.
- Physical briefing and break attendance tokens, consumed by the existing Live Floor scheduled-event engine.
- Reception clock-out after the Live Floor shift has ended.
- Supervisor-assistance requests for escalation, policy guidance, system issues, customer safety and workload support.
- Optional GLB loading for the reception desk and receptionist using the existing local model folders.
- Location-proximity checks for staff actions and workstation entry.
- Legacy migration for already-running v6.2 shifts.

## Preserved
- Existing customer queue, synthetic scenarios, three-stage customer handling, Customer 360/case bridge and career progression.
- Existing desk/computer/agent/supervisor GLB loading; missing human models are not replaced with primitive people.
- Existing v6.0/v6.1 local-storage records and v6.2 routes.

## Boundaries
- Routine, attendance and supervisor request records are browser-local.
- Supervisor requests are logged locally; they are not live notifications to a real supervisor.
- No real biometric attendance, telephony, external messaging or central HR integration is added.
