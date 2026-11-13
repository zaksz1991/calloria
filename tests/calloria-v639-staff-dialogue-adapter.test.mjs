import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  installCalloriaStaffDialogueAdapter,
  installCalloriaNativeSpeechBridge,
  transformStaffRuntimeIntegration
} from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(path.join(here, 'fixtures/glb-world-integration-v12.fixture.js'), 'utf8');
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = { 'female-agent': 'static-mesh', 'male-agent': 'skinned-static-pose', 'gp5-woman': 'animated-skinned' };
const transformed = transformStaffRuntimeIntegration(fixture, ids, modes);

function createEventHost(voice) {
  const listeners = new Map();
  const dispatched = [];
  class FakeCustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail || {}; }
  }
  const hostWindow = {
    CustomEvent: FakeCustomEvent,
    CalloriaStaffVoice: voice,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatchEvent(event) {
      dispatched.push(event);
      for (const listener of [...(listeners.get(event.type) || [])]) listener(event);
      return true;
    }
  };
  return { hostWindow, dispatched, listeners };
}

function createVoiceMock() {
  const calls = [];
  let supported = true;
  return {
    calls,
    setSupported(value) { supported = value; },
    isSupported() { return supported; },
    enqueue(payload) { calls.push({ action: 'enqueue', payload }); return Promise.resolve({ status: 'ended', assetId: payload.assetId }); },
    speak(payload) { calls.push({ action: 'speak', payload }); return Promise.resolve({ status: 'ended', assetId: payload.assetId }); },
    stop(assetId) { calls.push({ action: 'stop', assetId }); return true; },
    pause() { calls.push({ action: 'pause' }); return true; },
    resume() { calls.push({ action: 'resume' }); return true; },
    clearQueue(assetId) { calls.push({ action: 'clear', assetId }); return 2; },
    getQueueState() { return { queued: 2, active: false, paused: false }; }
  };
}

test('v6.39 transformed runtime installs the dialogue event adapter beside native voice', () => {
  assert.ok(transformed.code);
  assert.deepEqual(transformed.warnings || [], []);
  assert.equal(transformed.staffDialogueEventAdapterAdded, true);
  assert.match(transformed.code, /__CALLORIA_STAFF_DIALOGUE_EVENT_ADAPTER_V639__/);
  assert.match(transformed.code, /installCalloriaStaffDialogueAdapter/);
  const again = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(again.code, transformed.code);
  assert.equal(again.alreadyPatched, true);
});

test('say() routes dialogue through the queue and resolves after the adapter result event', async () => {
  const voice = createVoiceMock();
  const browser = createEventHost(voice);
  const api = installCalloriaStaffDialogueAdapter(browser.hostWindow);
  const result = await api.say({ assetId: 'female-agent', text: 'Welcome to support.', lang: 'en-NG' });
  assert.deepEqual(result, { status: 'ended', assetId: 'female-agent' });
  assert.equal(voice.calls[0].action, 'enqueue');
  assert.equal(voice.calls[0].payload.text, 'Welcome to support.');
  const response = browser.dispatched.find((event) => event.type === 'calloria:staff-dialogue-result');
  assert.equal(response.detail.status, 'completed');
  assert.match(response.detail.requestId, /^dialogue-/);
});

test('interrupt() immediately routes to the interruptive native voice method', async () => {
  const voice = createVoiceMock();
  const browser = createEventHost(voice);
  const api = installCalloriaStaffDialogueAdapter(browser.hostWindow);
  const result = await api.interrupt({ assetId: 'male-agent', text: 'Urgent service update.' });
  assert.equal(result.status, 'ended');
  assert.equal(voice.calls[0].action, 'speak');
});

test('external call-handling events can enqueue a line without calling the adapter API', async () => {
  const voice = createVoiceMock();
  const browser = createEventHost(voice);
  installCalloriaStaffDialogueAdapter(browser.hostWindow);
  browser.hostWindow.dispatchEvent(new browser.hostWindow.CustomEvent('calloria:staff-dialogue-request', {
    detail: { requestId: 'crm-turn-17', action: 'enqueue', assetId: 'gp5-woman', text: 'The agent will be with you shortly.' }
  }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(voice.calls[0].action, 'enqueue');
  const result = browser.dispatched.find((event) => event.type === 'calloria:staff-dialogue-result');
  assert.equal(result.detail.requestId, 'crm-turn-17');
  assert.equal(result.detail.status, 'completed');
});

test('control actions route to stop, pause, resume and targeted queue clearing', async () => {
  const voice = createVoiceMock();
  const browser = createEventHost(voice);
  const api = installCalloriaStaffDialogueAdapter(browser.hostWindow);
  assert.equal(await api.stop('female-agent'), true);
  assert.equal(await api.pause(), true);
  assert.equal(await api.resume(), true);
  assert.equal(await api.clearQueue('male-agent'), 2);
  assert.deepEqual(voice.calls.map((entry) => entry.action), ['stop', 'pause', 'resume', 'clear']);
  assert.equal(voice.calls.at(-1).assetId, 'male-agent');
});

test('unsupported actions become result errors and reject API requests', async () => {
  const voice = createVoiceMock();
  const browser = createEventHost(voice);
  const api = installCalloriaStaffDialogueAdapter(browser.hostWindow);
  await assert.rejects(api.request({ action: 'teleport', assetId: 'female-agent' }), /Unsupported staff dialogue action/);
  const result = browser.dispatched.find((event) => event.type === 'calloria:staff-dialogue-result');
  assert.equal(result.detail.status, 'error');
  assert.match(result.detail.error, /Unsupported staff dialogue action/);
  assert.equal(api.getStatus().failed, 1);
});

test('adapter exposes queue and speech support diagnostics', () => {
  const voice = createVoiceMock();
  const browser = createEventHost(voice);
  const api = installCalloriaStaffDialogueAdapter(browser.hostWindow);
  assert.deepEqual(api.getStatus(), {
    received: 0, completed: 0, failed: 0, pendingRequests: 0,
    lastAction: null, lastAssetId: null, lastError: null,
    voice: { queued: 2, active: false, paused: false }, supported: true
  });
});

test('adapter preserves an application-owned dialogue object and does not overwrite it', () => {
  const existing = { appOwned: true };
  const voice = createVoiceMock();
  const browser = createEventHost(voice);
  browser.hostWindow.CalloriaStaffDialogue = existing;
  assert.equal(installCalloriaStaffDialogueAdapter(browser.hostWindow), existing);
  assert.equal(browser.hostWindow.CalloriaStaffDialogue, existing);
  assert.equal(browser.listeners.size, 0);
});

test('dispose removes listeners, rejects pending requests and releases its global API', async () => {
  const voice = createVoiceMock();
  let release;
  voice.enqueue = () => new Promise((resolve) => { release = resolve; });
  const browser = createEventHost(voice);
  const api = installCalloriaStaffDialogueAdapter(browser.hostWindow);
  const pending = api.say({ assetId: 'female-agent', text: 'Pending line.' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(api.getStatus().pendingRequests, 1);
  assert.equal(api.dispose(), true);
  await assert.rejects(pending, /disposed/);
  assert.equal(browser.hostWindow.CalloriaStaffDialogue, undefined);
  assert.equal(browser.listeners.get('calloria:staff-dialogue-request').size, 0);
  assert.equal(browser.listeners.get('calloria:staff-dialogue-result').size, 0);
  release?.({ status: 'ended' });
});

test('adapter installation requires an existing voice bridge and browser event support', () => {
  assert.equal(installCalloriaStaffDialogueAdapter({}), null);
  const noVoice = createEventHost(null);
  assert.equal(installCalloriaStaffDialogueAdapter(noVoice.hostWindow), null);
  const voice = createVoiceMock();
  const noEvents = { CalloriaStaffVoice: voice };
  assert.equal(installCalloriaStaffDialogueAdapter(noEvents), null);
});
