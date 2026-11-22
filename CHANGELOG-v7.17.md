# Changelog — CALLORIA v7.17

## Digital Specialist Handoff & Supervisor Routing

- Added a specialist destination selector to the existing digital after-contact form when the disposition is `escalated`.
- Added mandatory handoff reason validation: 12–240 characters after whitespace/control-character normalization.
- Restricted destinations to a fixed list of nine operational departments.
- Creates or augments an open item in the existing Supervisor Escalations queue only after digital contact completion succeeds.
- Links the request and resulting CRM case through `linkedCaseReference` and `supervisorRequestId`.
- Records the requested destination, reason, requester, timestamp and request history.
- Shows the requested specialist destination on the existing supervisor escalation card.
- Preserves existing supervisor assignment/escalation state when augmenting an open request.
- Adds responsive styling and native hidden/disabled/required field behaviour.
- Leaves actual WhatsApp and SMS restricted inboxes, external provider integrations, Supabase and saved employment records unchanged.

## Compatibility

The plugin is designed to run after the current `js/main.js` integrations. It uses exact-one source anchors and aborts safely when the source structure has drifted. It is idempotent when its marker is already present.
