import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  installCalloriaContactSessionDialogueBridge,
  installCalloriaStaffDialogueAdapter,
  transformStaffRuntimeIntegration
} from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(path.join(here, 'fixtures/glb-world-integration-v12.fixture.js'), 'utf8');
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = { 'female-agent': 'static-mesh', 'male-agent': 'skinned-static-pose', 'gp5-woman': 'animated-skinned' };

function createHost(voice = createVoice()) {
  const listeners = new Map();
  const events = [];
  class FakeCustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail || {}; } }
  const hostWindow = {
    CustomEvent: FakeCustomEvent,
    CalloriaStaffVoice: voice,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatchEvent(event) {
      events.push(event);
      for (const listener of [...(listeners.get(event.type) || [])]) listener(event);
      return true;
    }
  };
  const dialogue = installCalloriaStaffDialogueAdapter(hostWindow);
  return { hostWindow, events, listeners, voice, dialogue };
}

function createVoice() {
  const calls = [];
  return {
    calls,
    enqueue(payload) { calls.push({ action: 'enqueue', payload }); return Promise.resolve({ status: 'ended', assetId: payload.assetId }); },
    speak(payload) { calls.push({ action: 'interrupt', payload }); return Promise.resolve({ status: 'ended', assetId: payload.assetId }); },
    stop(assetId) { calls.push({ action: 'stop', assetId }); return true; },
    pause() { calls.push({ action: 'pause' }); return true; },
    resume() { calls.push({ action: 'resume' }); return true; },
    clearQueue(assetId) { calls.push({ action: 'clear', assetId }); return 0; },
    getQueueState() { return { queued: 0, active: false, paused: false }; },
    isSupported() { return true; }
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('v6.40 runtime transform installs the session bridge after the staff dialogue adapter', () => {
  const transformed = transformStaffRuntimeIntegration(fixture, ids, modes);
  assert.ok(transformed.code);
  assert.deepEqual(transformed.warnings || [], []);
  assert.equal(transformed.contactSessionDialogueBridgeAdded, true);
  assert.match(transformed.code, /__CALLORIA_CONTACT_SESSION_DIALOGUE_BRIDGE_V640__/);
  assert.match(transformed.code, /installCalloriaContactSessionDialogueBridge/);
  const again = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(again.code, transformed.code);
  assert.equal(again.alreadyPatched, true);
});

test('v6.40 upgrades a deployed v6.39 runtime without duplicating native voice or dialogue adapters', () => {
  const v640 = transformStaffRuntimeIntegration(fixture, ids, modes);
  const contactCall = `(${installCalloriaContactSessionDialogueBridge.toString()})(window);`;
  let v639Runtime = v640.code.replace(contactCall, '');
  v639Runtime = v639Runtime.replace('/* __CALLORIA_CONTACT_SESSION_DIALOGUE_BRIDGE_V640__ */', '');
  const upgraded = transformStaffRuntimeIntegration(v639Runtime, ids, modes);
  assert.ok(upgraded.code);
  assert.deepEqual(upgraded.warnings || [], []);
  assert.equal(upgraded.contactSessionDialogueBridgeAdded, true);
  assert.equal(upgraded.code.split(contactCall).length - 1, 1);
  assert.equal(upgraded.code.split('/* __CALLORIA_NATIVE_SPEECH_SYNTHESIS_BRIDGE_V637__ */').length - 1, 1);
  const again = transformStaffRuntimeIntegration(upgraded.code, ids, modes);
  assert.equal(again.code, upgraded.code);
  assert.equal(again.alreadyPatched, true);
});

test('start creates a session and say routes text through the selected agent voice', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  assert.ok(api);
  const started = await api.start({ sessionId: 'call-1001', assetId: 'female-agent' });
  assert.deepEqual({ sessionId: started.sessionId, assetId: started.assetId, state: started.state }, {
    sessionId: 'call-1001', assetId: 'female-agent', state: 'connected'
  });
  const result = await api.say({ sessionId: 'call-1001', text: 'Good morning. How may I help you?', lang: 'en-NG' });
  assert.equal(result.status, 'ended');
  assert.equal(host.voice.calls[0].action, 'enqueue');
  assert.equal(host.voice.calls[0].payload.assetId, 'female-agent');
  assert.equal(host.voice.calls[0].payload.text, 'Good morning. How may I help you?');
  assert.equal(api.getStatus().active.utterances, 1);
});

test('session ownership blocks stale call UI from speaking through another agent', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  await api.start({ sessionId: 'call-A', assetId: 'female-agent' });
  await assert.rejects(api.say({ sessionId: 'call-B', text: 'Wrong call.' }), /does not match the active call/);
  assert.equal(host.voice.calls.length, 0);
});

test('hold blocks new agent speech and resume re-enables the active session', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  await api.start({ sessionId: 'call-hold', assetId: 'male-agent' });
  await api.hold('call-hold');
  assert.equal(api.getStatus().active.state, 'held');
  await assert.rejects(api.say({ text: 'Cannot speak while held.' }), /not connected/);
  await api.resume('call-hold');
  assert.equal(api.getStatus().active.state, 'connected');
  await api.say({ text: 'We are back on the line.' });
  assert.equal(host.voice.calls.filter((call) => call.action === 'enqueue').length, 1);
  assert.deepEqual(host.voice.calls.map((call) => call.action), ['pause', 'resume', 'enqueue']);
});

test('replaying the same connect event does not resume a held call', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  await api.start({ sessionId: 'call-held-idempotent', assetId: 'female-agent' });
  await api.hold('call-held-idempotent');
  await api.start({ sessionId: 'call-held-idempotent', assetId: 'female-agent' });
  assert.equal(api.getStatus().active.state, 'held');
  await assert.rejects(api.interrupt({ text: 'Do not speak while held.' }), /not connected/);
  assert.deepEqual(host.voice.calls.map((call) => call.action), ['pause']);
});

test('interrupt sends urgent agent speech through the interrupt method', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  await api.start({ sessionId: 'call-urgent', assetId: 'gp5-woman' });
  await api.interrupt({ text: 'Please remain on the line.' });
  assert.equal(host.voice.calls[0].action, 'interrupt');
  assert.equal(host.voice.calls[0].payload.assetId, 'gp5-woman');
});

test('replacing an active call stops and clears the previous agent queue', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  await api.start({ sessionId: 'call-old', assetId: 'female-agent' });
  await api.start({ sessionId: 'call-new', assetId: 'male-agent' });
  assert.deepEqual(host.voice.calls.map((call) => [call.action, call.assetId]), [
    ['stop', 'female-agent'], ['clear', 'female-agent']
  ]);
  assert.equal(api.getStatus().active.sessionId, 'call-new');
});

test('end stops and clears the active agent queue and releases the session', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  await api.start({ sessionId: 'call-end', assetId: 'female-agent' });
  assert.equal(await api.end('call-end'), true);
  assert.equal(api.getStatus().active, null);
  assert.deepEqual(host.voice.calls.map((call) => call.action), ['stop', 'clear']);
  assert.equal(await api.end(), false);
});

test('contact-dialogue CustomEvents support the full contact lifecycle', async () => {
  const host = createHost();
  installCalloriaContactSessionDialogueBridge(host.hostWindow);
  const dispatch = (detail) => host.hostWindow.dispatchEvent(new host.hostWindow.CustomEvent('calloria:contact-dialogue', { detail }));
  dispatch({ requestId: 'crm-start-1', action: 'start', sessionId: 'crm-call-1', assetId: 'female-agent' });
  await tick();
  dispatch({ requestId: 'crm-say-1', action: 'say', sessionId: 'crm-call-1', text: 'Your case is being checked.' });
  await tick();
  dispatch({ requestId: 'crm-hold-1', action: 'hold', sessionId: 'crm-call-1' });
  await tick();
  dispatch({ requestId: 'crm-resume-1', action: 'resume', sessionId: 'crm-call-1' });
  await tick();
  dispatch({ requestId: 'crm-end-1', action: 'end', sessionId: 'crm-call-1' });
  await tick();
  const results = host.events.filter((event) => event.type === 'calloria:contact-dialogue-result');
  assert.equal(results.length, 5);
  assert.ok(results.every((event) => event.detail.status === 'completed'));
  assert.equal(host.voice.calls.filter((call) => call.action === 'enqueue').length, 1);
});

test('duplicate request IDs do not play the same line twice', async () => {
  const host = createHost();
  installCalloriaContactSessionDialogueBridge(host.hostWindow);
  const dispatch = (detail) => host.hostWindow.dispatchEvent(new host.hostWindow.CustomEvent('calloria:contact-dialogue', { detail }));
  dispatch({ requestId: 'start-once', action: 'start', sessionId: 'dedupe-call', assetId: 'female-agent' });
  await tick();
  const request = { requestId: 'say-once', action: 'say', sessionId: 'dedupe-call', text: 'Duplicate protection.' };
  dispatch(request);
  await tick();
  dispatch(request);
  await tick();
  assert.equal(host.voice.calls.filter((call) => call.action === 'enqueue').length, 1);
  assert.ok(host.events.some((event) => event.type === 'calloria:contact-dialogue-result' && event.detail.status === 'duplicate'));
});

test('malformed IDs, empty text and unsupported actions fail closed', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  await assert.rejects(api.start({ sessionId: '../escape', assetId: 'female-agent' }), /Invalid contact dialogue session ID/);
  await api.start({ sessionId: 'safe-call', assetId: 'female-agent' });
  await assert.rejects(api.say({ text: '   ' }), /text is required/);
  host.hostWindow.dispatchEvent(new host.hostWindow.CustomEvent('calloria:contact-dialogue', {
    detail: { requestId: 'unsupported-1', action: 'destroy-world', sessionId: 'safe-call' }
  }));
  await tick();
  const result = host.events.find((event) => event.type === 'calloria:contact-dialogue-result' && event.detail.requestId === 'unsupported-1');
  assert.equal(result.detail.status, 'error');
  assert.match(result.detail.error, /Unsupported contact dialogue action/);
});

test('dispose unregisters contact events, stops active audio and removes the global API', async () => {
  const host = createHost();
  const api = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  await api.start({ sessionId: 'dispose-call', assetId: 'male-agent' });
  assert.equal(await api.dispose(), true);
  assert.equal(host.hostWindow.CalloriaContactDialogue, undefined);
  assert.equal(host.listeners.get('calloria:contact-dialogue')?.size || 0, 0);
  assert.deepEqual(host.voice.calls.map((call) => call.action), ['stop', 'clear']);
});

test('bridge installation is idempotent and requires the dialogue API', () => {
  const host = createHost();
  const first = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  const second = installCalloriaContactSessionDialogueBridge(host.hostWindow);
  assert.equal(first, second);
  assert.equal(installCalloriaContactSessionDialogueBridge({}), null);
});
