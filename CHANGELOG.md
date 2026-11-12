# Changelog — CALLORIA v6.6

## Added
- Channel-specific Email response workspace with subject, body, response scaffold, quality review and send gate.
- Email quality checks for greeting, customer acknowledgement, action, next step, subject, sign-off, minimum detail, unfilled placeholders and credential-request safety.
- Priority-based simulated email response targets measured in shift minutes.
- Channel-specific Live Chat composer with one prepared customer-facing response required per service stage.
- Live Chat response timing, scripted customer follow-up and turn completion tracking.
- Email and Chat performance measures in completed-contact records and the shift report.
- Browser-local persistence and draft restoration for digital contacts.
- Responsive mobile presentation for both digital workspaces.

## Changed
- Email investigation decisions no longer create placeholder outbound email messages or artificial customer replies. The agent sends one complete final email after the three service stages.
- Live Chat transcript records the agent-authored composer text rather than the generic scenario decision text.
- Digital contacts cannot be wrapped up before their channel-specific response requirements are complete.

## Preserved
- v6.5 voice hold, resume, mute, supervisor consultation and warm-transfer workflow.
- v6.4 adaptive customer behaviour, v6.3 office routines, v6.1 career progression and existing Customer 360 case write-through.
- Social, SMS and In-app workflows remain unchanged.
