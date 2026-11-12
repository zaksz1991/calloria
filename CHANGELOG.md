# Changelog — CALLORIA v6.7

## Added
- Social response workspace with first-stage public reply and subsequent private follow-up stages.
- Public social privacy gate for apparent email addresses, phone numbers, long numeric identifiers and case/customer references.
- SMS service-response composer with character count and approximate GSM-compatible / Unicode segment estimates.
- Promotional SMS consent gate requiring an explicit consent flag in the contact record.
- In-app guided-support response composer with action-oriented instructions for later troubleshooting stages.
- Three-response preparation and commit workflow for Social, SMS and In-app contacts.
- Authored message write-through to the active interaction transcript, including public/private route metadata.
- Per-channel response timing and quality evidence in completed-contact records and shift reporting.
- Browser-local draft persistence and restoration for the new channels.
- Responsive mobile controls for the new workspace.

## Changed
- Live Floor accepts Social, SMS and In-app contacts only after a channel-safe customer-facing response is prepared for each service stage.
- Completed-contact handling column is now named Channel handling to include voice and all digital channels.
- Live Floor version label and footer updated to v6.7.

## Preserved
- v6.6 Email quality gate, simulated email SLA and three-stage Live Chat response workflow.
- v6.5 simulated voice hold, mute, supervisor consultation and warm transfer.
- v6.4 customer dynamics, v6.3 office routine, v6.1 career progression and existing Customer 360 / case write-through.
- The existing 3D workplace, GLB assets, Vite configuration and Supabase configuration.
