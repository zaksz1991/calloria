# CALLORIA v6.42 — Inbound agent response capture

## Integrated workflow

- Connects the existing microphone transcription and text-fallback panel to the currently active inbound call.
- Adds an explicit **Log agent response to contact** action. Transcripts are not added to the case history until the agent chooses this action.
- Applies a visible, rule-based communication check for empathy, ownership and a clear next step.
- Flags direct requests for PINs, passwords, OTPs, security codes or full card numbers as a critical compliance breach.
- Redacts long numeric sequences and security-token values before a logged response is retained.
- Adds logged agent statements to the active call timeline and the completed inbound CRM case transcript.
- Retains only the last 20 logged statements per active call.

## Privacy behaviour

Raw microphone audio remains in the existing page-memory flow and is not placed in the CRM record. A transcript is saved only after the explicit log action. Because the application calls its existing cloud-employment save from `saveState()`, a logged transcript may sync when cloud save is enabled. The consent copy and privacy notice explain this.

## Scope limits

This is a deterministic practice rubric, not an AI evaluator and not a real telephony connection. Speech recognition depends on browser support and permission. Text fallback remains available. The feature is inbound-call-only in this milestone.
