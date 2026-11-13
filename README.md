# CALLORIA v6.38 — Staff Voice Queue & Playback Controls

Builds on v6.37. The browser-native speech bridge can now queue multiple staff lines sequentially, pause/resume playback, clear pending lines by staff asset ID, and report its current queue state.

## API

Queue scripted dialogue without overlap:

```js
const firstLine = window.CalloriaStaffVoice.enqueue({
  assetId: 'female-agent', text: 'Good morning. Thank you for contacting support.', lang: 'en-NG'
});
const secondLine = window.CalloriaStaffVoice.enqueue({
  assetId: 'male-agent', text: 'I will take over from here.', lang: 'en-NG'
});
await Promise.all([firstLine, secondLine]);
```

Playback controls:

```js
window.CalloriaStaffVoice.pause();
window.CalloriaStaffVoice.resume();
window.CalloriaStaffVoice.clearQueue('female-agent'); // omit ID to clear all pending lines
window.CalloriaStaffVoice.getQueueState();
```

`enqueue()` accepts up to 30 pending lines. Each line retains the v6.37 2,000-character limit and installed browser voice options. `speak()` remains immediate: it clears pending lines and interrupts current playback. `stop()` stops the current utterance; queued lines continue afterwards unless separately cleared.

The contact-handling interface must still call this bridge. This patch does not modify the actual call UI or assert automatic integration. Browser playback and installed voices depend on device/browser policy; start audio from a user gesture where required.
