# CALLORIA v1.8 Change Log

- Replaced static reception-only customer placement with queue, approach, service, supervisor-wait, and departure states.
- Linked journey states to the existing `calloria:customer-reaction` event contract.
- Added FIFO handling when a second scenario starts while no customer slot is free.
- Added a supervisor escalation event and command contract without inventing a supervisor model or UI.
- Added procedural arm/leg gait when customer GLBs do not contain a walk clip.
- Retained approved-GLB validation, existing Three.js scene/render loop, existing reaction profiles, and procedural fallback.
- Added focused pure-controller regression tests.
