# CALLORIA v6.41 — Integrated inbound agent voice

This patch connects the existing live inbound conversation workflow (v4.4) to the existing GLB staff contact-dialogue runtime (v6.40).

## Runtime changes

- Captures only GLB staff asset IDs reported as actually placed by the production world's `onAssetsReady` status.
- Starts a staff dialogue session when an inbound customer contact is accepted.
- Speaks the agent's submitted response using the existing browser speech-synthesis bridge, with the associated GLB staff asset receiving the existing speech/mouth-motion event.
- Adds a `Play agent voice` control to replay the latest submitted agent line.
- Holds, resumes and ends the staff dialogue session with the existing call lifecycle.
- Leaves the existing customer voice, CRM, case creation, queue, KPI and wrap-up paths in place.

No GLB assets, Supabase configuration, API keys, package dependencies or customer data are modified.

## Limits

Speech uses the browser's native Speech Synthesis support. Availability and voice selection depend on the browser/device. It is simulated in-game voice, not a PSTN/VoIP connection. Staff mouth movement only occurs for supported morph targets on the selected loaded staff asset. The runtime uses the first actually placed staff GLB ID as its speaking visual target; it does not yet map a unique player workstation to a unique staff instance.
