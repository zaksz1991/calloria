# CALLORIA v6.40 — Contact Session Dialogue Bridge

- Added `window.CalloriaContactDialogue` as a session-aware controller above the existing staff dialogue and browser speech APIs.
- Added session start, queued agent speech, urgent interruption, hold, resume and end operations.
- Added single-active-contact ownership so stale call UI cannot send speech through the wrong agent asset.
- Automatically stops and clears the previous staff queue when a new contact session replaces it.
- Added a held-state guard so new utterances are rejected until the contact resumes.
- Added `calloria:contact-dialogue` request events with correlated result, state and utterance events.
- Added duplicate request ID protection, bounded identifiers and a 3,000-character utterance limit.
- Added status reporting and listener/audio cleanup on disposal.
- Preserved the v6.38 native speech queue, v6.39 staff dialogue adapter, existing morph animation and authored GLB animations.
- Upgraded existing v6.39 transformed runtime output without duplicating native voice or dialogue installers.
