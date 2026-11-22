# Source baseline — CALLORIA v7.10

Target: public `main` branch of `github.com/zaksz1991/calloria`, inspected 22 November 2026.

Relevant existing source:

- `js/main.js`: `renderInbound()` begins around line 1085. The active-call view creates `voiceBehaviour`, `pendingDecision`, `voiceMonitor` and `continuityPanel`, and the live call template includes `${voiceMonitor}${continuityPanel}`. The v7.10 transform inserts the coach between those existing panels. The voice-response form uses `#voiceReplyText` in `renderVoicePractice()` around lines 926–950.
- `js/main.js`: `recordInboundVoiceTurn()` and `resolveInboundVoiceDecision()` remain the authoritative native response/evaluation paths. The v7.10 package does not alter them.
- `build/calloria-first-shift-gameplay-plugin.js`: existing events report employment, shift start, inbound customer connected, case saved and other gameplay milestones. v7.10 does not replace this bridge.
- `build/calloria-ojt-runtime.js`: existing OJT profile includes knowledge, logging, shadowing and supervised practice progress. v7.10 does not change onboarding state.
- `vite.config.js`: existing transform chain has the live voice/gameplay systems and public experience plugins. Add v7.10 as a final post-transform plugin; do not replace the configuration.

Public source references:

- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/build/calloria-first-shift-gameplay-plugin.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/build/calloria-ojt-runtime.js

Source compatibility is tested against a focused fixture built from the current live-call template anchors. No full repository checkout was available for a full Vite build.
