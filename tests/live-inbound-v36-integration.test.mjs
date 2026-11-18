import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { __calloriaV36Test } from '../build/calloria-live-inbound-conversation-v3-6-plugin.mjs';

const mainSource = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

 test('current inbound application retains the integrated customer-operations and voice workflow', () => {
  assert.ok(mainSource.includes('function startInboundCall()'));
  assert.ok(mainSource.includes('function renderInbound()'));
  assert.ok(mainSource.includes('function submitInboundVoiceResponse(value)'));
  assert.ok(mainSource.includes('function beginInboundWrapUp(transferred = false)'));
  assert.ok(mainSource.includes('function saveWrapUp()'));
});

test('inbound workspace supports guided call procedures and live free-form customer responses', () => {
  const start = mainSource.indexOf('function renderInbound() {');
  const end = mainSource.indexOf('function ensureDigitalQueue(', start);
  const inbound = mainSource.slice(start, end);
  assert.ok(inbound.includes('data-call-choice'));
  assert.ok(inbound.includes('renderVoicePractice(call,latestCustomerMessage)'));
  assert.ok(inbound.includes('Live call transcript'));
  assert.ok(inbound.includes('CUSTOMER RESPONSE REQUIRED'));
});

test('free-text voice responses update customer behaviour, timeline, scoring and the wrap-up record', () => {
  assert.ok(mainSource.includes("recordInboundVoiceTurn(call,contact,safe,'free_response')"));
  assert.ok(mainSource.includes('call.behaviourScore=Math.max(-8'));
  assert.ok(mainSource.includes('addCallTimeline(call,source==='));
  assert.ok(mainSource.includes('voiceCustomerOutcome(call.voiceBehaviour)'));
  assert.ok(mainSource.includes('voiceTranscript:wrap.voiceBehaviour?.transcript'));
});

test('retired v3.6 source transformer yields to the current adaptive voice workflow', () => {
  assert.equal(__calloriaV36Test.transformMain({ error(message) { throw new Error(message); } }, mainSource), null);
});

test('existing HTML remains compatible with responsive conversation styling assets', () => {
  assert.ok(htmlSource.includes('styles.css'));
});
