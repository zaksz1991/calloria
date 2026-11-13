# v6.38 — Staff Voice Queue & Playback Controls

- Added `enqueue()` for sequential agent dialogue without overlapping browser utterances.
- Added queue pause/resume, targeted pending-line clearing and queue-state inspection.
- Kept `speak()` as an immediate/interruptive call; it clears pending queue items before speaking.
- Added a maximum of 30 pending queue entries and retained the existing 2,000-character per-utterance limit.
- Kept mouth-morph events tied to native utterance start/end and targeted to the correct staff asset.
- Preserved stop/cancel semantics and existing browser voice selection options.
