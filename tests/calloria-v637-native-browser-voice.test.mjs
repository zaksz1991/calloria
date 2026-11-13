import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  installCalloriaNativeSpeechBridge,
  transformStaffRuntimeIntegration
} from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(path.join(here, 'fixtures/glb-world-integration-v12.fixture.js'), 'utf8');
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = { 'female-agent': 'static-mesh', 'male-agent': 'skinned-static-pose', 'gp5-woman': 'animated-skinned' };
const transformed = transformStaffRuntimeIntegration(fixture, ids, modes);

function createFakeBrowser({ supported = true, existingApi = null } = {}) {
  const events = [];
  const utterances = [];
  const voices = [{ name: 'English Voice', voiceURI: 'voice-en-1', lang: 'en-GB', default: true, localService: true }];
  class FakeCustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail || {}; }
  }
  class FakeUtterance {
    constructor(text) { this.text = text; this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = ''; this.voice = null; utterances.push(this); }
  }
  const synthesis = supported ? {
    cancelCalls: 0,
    pauseCalls: 0,
    resumeCalls: 0,
    getVoices: () => voices,
    speak(utterance) { this.lastUtterance = utterance; },
    cancel() { this.cancelCalls += 1; },
    pause() { this.pauseCalls += 1; },
    resume() { this.resumeCalls += 1; }
  } : null;
  const hostWindow = {
    CustomEvent: FakeCustomEvent,
    SpeechSynthesisUtterance: supported ? FakeUtterance : undefined,
    speechSynthesis: synthesis,
    dispatchEvent(event) { events.push(event); return true; }
  };
  if (existingApi) hostWindow.CalloriaStaffVoice = existingApi;
  return { hostWindow, events, utterances, voices, synthesis };
}

test('v6.37 transforms the checked staff runtime and installs the native voice bridge', () => {
  assert.ok(transformed.code);
  assert.deepEqual(transformed.warnings || [], []);
  assert.equal(transformed.nativeSpeechSynthesisBridgeAdded, true);
  assert.match(transformed.code, /__CALLORIA_NATIVE_SPEECH_SYNTHESIS_BRIDGE_V637__/);
  assert.match(transformed.code, /CalloriaStaffVoice/);
  assert.match(transformed.code, /installCalloriaNativeSpeechBridge/);
});

test('browser bridge emits targeted speaking events only when native audio starts and ends', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const pending = api.speak({ assetId: 'female-agent', text: 'Welcome to RuffNeck support.', intensity: 0.7 });
  const utterance = browser.utterances[0];
  assert.equal(browser.events.length, 0, 'mouth should not move before the browser starts audio');
  utterance.onstart();
  assert.equal(browser.events.length, 1);
  assert.equal(browser.events[0].type, 'calloria:staff-speaking');
  assert.deepEqual(browser.events[0].detail, { assetId: 'female-agent', speaking: true, intensity: 0.7 });
  utterance.onend();
  assert.deepEqual(await pending, { status: 'ended', assetId: 'female-agent' });
  assert.equal(browser.events.length, 2);
  assert.deepEqual(browser.events[1].detail, { assetId: 'female-agent', speaking: false, intensity: 0.7 });
});

test('voice options are clamped and a requested installed browser voice is selected', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const pending = api.speak({
    assetId: 'male-agent', text: 'Hello.', lang: 'en-GB', voiceURI: 'voice-en-1',
    rate: 9, pitch: 0.1, volume: 3, intensity: -4
  });
  const utterance = browser.utterances[0];
  assert.equal(utterance.lang, 'en-GB');
  assert.equal(utterance.rate, 2);
  assert.equal(utterance.pitch, 0.5);
  assert.equal(utterance.volume, 1);
  assert.equal(utterance.voice, browser.voices[0]);
  assert.deepEqual(api.getVoices()[0], {
    name: 'English Voice', voiceURI: 'voice-en-1', lang: 'en-GB', default: true, localService: true
  });
  utterance.onstart();
  assert.equal(browser.events[0].detail.intensity, 0);
  utterance.onend();
  await pending;
});

test('starting a replacement utterance cancels the prior speaker and resolves its promise', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const first = api.speak({ assetId: 'female-agent', text: 'First line.' });
  const second = api.speak({ assetId: 'male-agent', text: 'Second line.' });
  assert.deepEqual(await first, { status: 'cancelled', assetId: 'female-agent' });
  assert.equal(browser.synthesis.cancelCalls, 1);
  browser.utterances[0].onstart();
  assert.equal(browser.events.length, 0, 'callbacks from a cancelled utterance must be ignored');
  browser.utterances[1].onstart();
  assert.equal(browser.events[0].detail.assetId, 'male-agent');
  browser.utterances[1].onend();
  assert.deepEqual(await second, { status: 'ended', assetId: 'male-agent' });
});

test('stop is asset-targeted and emits a final speaking=false event', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const pending = api.speak({ assetId: 'gp5-woman', text: 'Please wait.' });
  browser.utterances[0].onstart();
  assert.equal(api.stop('female-agent'), false);
  assert.equal(api.stop('gp5-woman'), true);
  assert.deepEqual(await pending, { status: 'cancelled', assetId: 'gp5-woman' });
  assert.equal(browser.events.at(-1).detail.speaking, false);
  assert.equal(api.stop(), false);
});

test('invalid targets, oversized text and unsupported browsers fail safely', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  await assert.rejects(api.speak({ text: 'Missing target' }), /assetId is required/);
  await assert.rejects(api.speak({ assetId: 'female-agent', text: 'x'.repeat(2001) }), /2000 characters/);
  const unsupported = createFakeBrowser({ supported: false });
  const unsupportedApi = installCalloriaNativeSpeechBridge(unsupported.hostWindow);
  assert.equal(unsupportedApi.isSupported(), false);
  await assert.rejects(unsupportedApi.speak({ assetId: 'female-agent', text: 'Hello' }), /not available/);
});

test('native bridge preserves a pre-existing application voice API', () => {
  const existing = { speak() { return 'app-owned'; } };
  const browser = createFakeBrowser({ existingApi: existing });
  assert.equal(installCalloriaNativeSpeechBridge(browser.hostWindow), existing);
  assert.equal(browser.hostWindow.CalloriaStaffVoice, existing);
});

test('native bridge transform is idempotent and still fails closed on changed runtime anchors', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.ok(second.code);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.nativeSpeechSynthesisBridgeAdded, false);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});


test('queued lines play sequentially and keep mouth events targeted to each speaker', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const first = api.enqueue({ assetId: 'female-agent', text: 'Good morning.' });
  const second = api.enqueue({ assetId: 'male-agent', text: 'How can I help?' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.utterances.length, 1, 'only one queued utterance may run at a time');
  assert.equal(browser.utterances[0].text, 'Good morning.');
  assert.equal(api.getQueueState().queued, 1);
  browser.utterances[0].onstart();
  browser.utterances[0].onend();
  assert.equal((await first).status, 'ended');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.utterances.length, 2);
  assert.equal(browser.utterances[1].text, 'How can I help?');
  browser.utterances[1].onstart();
  assert.equal(browser.events.at(-1).detail.assetId, 'male-agent');
  browser.utterances[1].onend();
  assert.equal((await second).status, 'ended');
  assert.deepEqual(api.getQueueState(), {
    queued: 0, active: false, activeAssetId: null, paused: false, queuedAssetIds: []
  });
});

test('queue pause holds pending lines and resume continues playback', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const first = api.enqueue({ assetId: 'female-agent', text: 'First.' });
  const second = api.enqueue({ assetId: 'female-agent', text: 'Second.' });
  api.pause();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.utterances.length, 0);
  assert.equal(api.getQueueState().paused, true);
  api.resume();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.synthesis.pauseCalls, 1);
  assert.equal(browser.synthesis.resumeCalls, 1);
  assert.equal(browser.utterances.length, 1);
  browser.utterances[0].onend();
  assert.equal((await first).status, 'ended');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.utterances.length, 2);
  browser.utterances[1].onend();
  assert.equal((await second).status, 'ended');
});

test('clearQueue can cancel pending lines for one staff member without clearing others', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const active = api.enqueue({ assetId: 'female-agent', text: 'Active.' });
  const cancelled = api.enqueue({ assetId: 'male-agent', text: 'Remove me.' });
  const retained = api.enqueue({ assetId: 'gp5-woman', text: 'Keep me.' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(api.clearQueue('male-agent'), 1);
  assert.deepEqual(await cancelled, { status: 'cancelled', assetId: 'male-agent', queueId: 2 });
  assert.deepEqual(api.getQueueState().queuedAssetIds, ['gp5-woman']);
  browser.utterances[0].onend();
  await active;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.utterances.length, 2);
  browser.utterances[1].onend();
  assert.equal((await retained).status, 'ended');
});

test('direct speak interrupts queued playback and clears all waiting lines', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const queuedActive = api.enqueue({ assetId: 'female-agent', text: 'Queued current.' });
  const queuedNext = api.enqueue({ assetId: 'female-agent', text: 'Queued next.' });
  await new Promise((resolve) => setImmediate(resolve));
  const immediate = api.speak({ assetId: 'male-agent', text: 'Urgent update.' });
  assert.equal((await queuedActive).status, 'cancelled');
  assert.equal((await queuedNext).status, 'cancelled');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.utterances.at(-1).text, 'Urgent update.');
  browser.utterances.at(-1).onend();
  assert.equal((await immediate).status, 'ended');
});

test('a failed queued utterance rejects its promise and the following line still runs', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const first = api.enqueue({ assetId: 'female-agent', text: 'This line will fail.' });
  const second = api.enqueue({ assetId: 'male-agent', text: 'This line continues.' });
  await new Promise((resolve) => setImmediate(resolve));
  browser.utterances[0].onstart();
  browser.utterances[0].onerror({ error: 'audio-hardware' });
  await assert.rejects(first, /audio-hardware/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.utterances.length, 2);
  browser.utterances[1].onstart();
  browser.utterances[1].onend();
  assert.equal((await second).status, 'ended');
});

test('queue enforces the 30-line pending limit and reports pending count', async () => {
  const browser = createFakeBrowser();
  const api = installCalloriaNativeSpeechBridge(browser.hostWindow);
  const active = api.enqueue({ assetId: 'female-agent', text: 'Active line.' });
  await new Promise((resolve) => setImmediate(resolve));
  const pending = Array.from({ length: 30 }, (_, index) => api.enqueue({
    assetId: 'female-agent', text: `Pending line ${index + 1}.`
  }));
  await assert.rejects(api.enqueue({ assetId: 'female-agent', text: 'Overflow.' }), /queue is full/);
  assert.equal(api.getQueueState().queued, 30);
  assert.equal(api.clearQueue(), 30);
  const results = await Promise.all(pending);
  assert.ok(results.every((result) => result.status === 'cancelled'));
  api.stop('female-agent');
  assert.equal((await active).status, 'cancelled');
});
