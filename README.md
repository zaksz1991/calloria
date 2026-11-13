# CALLORIA v6.37 — Native Browser Staff Voice

Builds on v6.36 by adding a browser-native text-to-speech bridge that drives the existing staff mouth-morph event while spoken audio is actually playing.

## What changes

- Installs `window.CalloriaStaffVoice` when the browser supports the required event APIs and no app-owned object already uses that name.
- Uses the browser's native `SpeechSynthesis` and `SpeechSynthesisUtterance` APIs; it does not add a paid voice provider, API key, network request, microphone permission or server dependency.
- Dispatches `calloria:staff-speaking` with `speaking: true` on the utterance's `onstart`, and `speaking: false` on `onend`, `onerror` or explicit stop.
- Targets one staff member with `assetId` (or `agentId`), so only that model's compatible existing jaw/viseme morphs move.
- Supports installed browser voice selection, language, rate, pitch, volume and bounded mouth-motion intensity.
- Cancels the prior CALLORIA utterance when another staff member starts speaking; only one native utterance is active at a time.
- Preserves an existing `window.CalloriaStaffVoice` app object rather than overwriting it.
- Keeps v6.36's event receiver scoped to the staff runtime and removes its listener when that runtime is disposed.

## Calling the voice bridge

Call it from a user-initiated action or the existing agent-response handler after the selected agent's reply text is ready:

```js
await window.CalloriaStaffVoice.speak({
  assetId: 'female-agent',
  text: agentReply,
  lang: 'en-NG',
  rate: 0.98,
  pitch: 1,
  volume: 1,
  intensity: 0.68
});
```

Available installed browser voices can be inspected with:

```js
window.CalloriaStaffVoice.getVoices();
window.CalloriaStaffVoice.isSupported();
```

Stop the current utterance with:

```js
window.CalloriaStaffVoice.stop('female-agent');
```

`assetId` must match a placed staff GLB, for example `female-agent`, `male-agent`, `gp5-woman`, `mr-r`, or `office-lady-character`. The API uses one active browser utterance at a time; starting another one cancels the current utterance. Browser voice names and language availability depend on the user's device and browser. Use a user gesture to start speech where the browser requires it.

## Integration boundary

The production build plugin now installs the native speech API and connects its playback lifecycle to the existing v6.36 mouth-motion event. This patch does **not** edit the separate contact-handling UI to call `CalloriaStaffVoice.speak()` automatically. The existing agent-response handler still needs to invoke the documented API; no claim is made that current call screens already do so.

Models need compatible jaw/mouth/viseme morph targets for visible lip movement. Audio may play on a device even when a placed model does not contain those morphs.
