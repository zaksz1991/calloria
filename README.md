# CALLORIA v6.39 — Staff Dialogue Event Bridge

v6.39 provides a stable game-level interface for other CALLORIA modules to request spoken agent dialogue. It sits above the v6.38 native browser speech queue; it does not replace the queue or create a second audio system.

## Game-level API

Queue a staff line and wait for native speech playback to finish:

```js
await window.CalloriaStaffDialogue.say({
  assetId: 'female-agent',
  text: 'Good morning. Thank you for contacting RuffNeck support.',
  lang: 'en-NG'
});
```

Interrupt active speech with an urgent line:

```js
await window.CalloriaStaffDialogue.interrupt({
  assetId: 'male-agent',
  text: 'Please note that this service is temporarily unavailable.'
});
```

Other controls:

```js
window.CalloriaStaffDialogue.pause();
window.CalloriaStaffDialogue.resume();
window.CalloriaStaffDialogue.stop('female-agent');
window.CalloriaStaffDialogue.clearQueue('female-agent');
window.CalloriaStaffDialogue.getStatus();
```

## Event contract

A contact-handling or scenario module that prefers DOM events can dispatch:

```js
window.dispatchEvent(new CustomEvent('calloria:staff-dialogue-request', {
  detail: {
    requestId: 'crm-contact-1042-agent-reply-1',
    action: 'enqueue',
    assetId: 'female-agent',
    text: 'I can help you update your account details.',
    lang: 'en-NG'
  }
}));
```

Supported actions are `enqueue` (default), `interrupt`, `stop`, `pause`, `resume` and `clear`. Completion is returned in `calloria:staff-dialogue-result` with the same `requestId`; result details include `status: 'completed'` or `status: 'error'`.

The adapter also exposes `request(payload)` to dispatch a request and receive a Promise:

```js
await window.CalloriaStaffDialogue.request({
  action: 'enqueue', assetId: 'female-agent', text: 'How may I help you?'
});
```

All dialogue requests still require a valid staff `assetId`. Text length, browser voice support, playback queue capacity, user-gesture restrictions and installed voice availability remain governed by v6.38.

## Integration boundary

This patch installs the adapter into the staff runtime, but it does **not** edit the existing CRM/call-handling screen to generate dialogue requests automatically. That screen or scenario controller must call `CalloriaStaffDialogue.say()` / `request()` or dispatch `calloria:staff-dialogue-request`. The existing call system is not claimed to be automatically voice-enabled by this patch alone.
