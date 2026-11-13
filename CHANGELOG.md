# CALLORIA v6.39 — Staff Dialogue Event Bridge

- Added `window.CalloriaStaffDialogue` as a stable game-level dialogue API layered over the native browser speech queue.
- Added queued `say()`, interruptive `interrupt()`, `stop()`, `pause()`, `resume()` and targeted `clearQueue()` methods.
- Added the `calloria:staff-dialogue-request` event contract for contact handling, reception, scripted scenarios and other game modules.
- Added correlated `calloria:staff-dialogue-result` events and promise-based request completion/error handling.
- Added runtime counters for received, completed and failed requests, queue state, last action and last target staff asset.
- Preserved the existing `CalloriaStaffVoice` API and its browser speech / mouth-morph lifecycle.
- Added idempotent installation and explicit disposal of adapter event listeners.
