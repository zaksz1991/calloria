# CALLORIA v6.40 — Contact Session Dialogue Bridge

v6.40 adds a session-aware controller above the existing v6.39 staff dialogue API. It gives a call-handling module one contact-session lifecycle for starting an agent call, speaking queued lines, interrupting, holding, resuming and ending the call.

The controller does not create another audio engine. All audio and mouth-morph events continue through `CalloriaStaffDialogue` and the v6.38 native browser speech queue.

## Session API

Start the active workstation contact with the staff asset that owns the conversation:

```js
await window.CalloriaContactDialogue.start({
  sessionId: 'contact-1042',
  assetId: 'female-agent'
});
```

Queue the agent's next response:

```js
await window.CalloriaContactDialogue.say({
  sessionId: 'contact-1042',
  text: 'Good morning. Thank you for contacting RuffNeck support.',
  lang: 'en-NG'
});
```

Interrupt the current line for an urgent message:

```js
await window.CalloriaContactDialogue.interrupt({
  sessionId: 'contact-1042',
  text: 'Please remain on the line while I check that for you.'
});
```

Control the contact lifecycle:

```js
await window.CalloriaContactDialogue.hold('contact-1042');
await window.CalloriaContactDialogue.resume('contact-1042');
await window.CalloriaContactDialogue.end('contact-1042');
window.CalloriaContactDialogue.getStatus();
```

Only one active agent contact session is allowed per page/workstation. Starting a different session stops the previous agent's active speech and clears that agent's pending dialogue. Replaying `start()` for the same held session does not silently resume it. A held session rejects new agent dialogue until `resume()` is called. Ending a session stops speech and clears the matching staff queue.

## Event contract for call UI modules

A CRM or call-handling module can use a single namespaced event instead of calling the API directly:

```js
window.dispatchEvent(new CustomEvent('calloria:contact-dialogue', {
  detail: {
    requestId: 'contact-1042-turn-1',
    action: 'start',
    sessionId: 'contact-1042',
    assetId: 'female-agent'
  }
}));

window.dispatchEvent(new CustomEvent('calloria:contact-dialogue', {
  detail: {
    requestId: 'contact-1042-turn-2',
    action: 'say',
    sessionId: 'contact-1042',
    text: 'I can help you update your account details.',
    lang: 'en-NG'
  }
}));
```

Supported event actions: `start`, `say` / `enqueue`, `interrupt`, `hold`, `resume` and `end`. Results are emitted through `calloria:contact-dialogue-result` with the same `requestId`. Repeated request IDs are ignored and reported as `status: 'duplicate'`. Failures are returned as `status: 'error'` with an error message. State transitions are emitted through `calloria:contact-dialogue-state`; spoken-line outcomes use `calloria:contact-dialogue-utterance`.

## Integration boundary

This patch installs `window.CalloriaContactDialogue` and its event listener into the staff runtime. It does **not** modify the existing CRM/call screen to emit these events automatically, because that UI source is not included in this patch. The call screen or scenario controller still needs to invoke the API or dispatch the event contract above. Actual production integration and audio playback must be verified after deployment.

Voice availability, user-gesture restrictions, selected browser voices, speech queue capacity and mouth-morph support remain governed by the existing v6.37–v6.39 speech runtime.
