import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/supervisor-qa-engine.js', import.meta.url), 'utf8');
const sandbox = { globalThis: {}, module: { exports: {} } };
vm.runInNewContext(source, sandbox, { filename: 'supervisor-qa-engine.js' });
const Engine = sandbox.module.exports;

test('initial state contains a multi-channel agent roster and contact queue', () => {
  const state = Engine.createInitialState();
  assert.equal(state.version, 47);
  assert.equal(state.agents.length, 5);
  assert.deepEqual([...new Set(state.interactions.map((item) => item.channel))].sort(), ['Email', 'Live chat', 'Social', 'Voice']);
  assert.equal(state.escalations.length, 3);
});

test('weighted QA score returns 100 when every criterion is excellent', () => {
  const responses = Object.fromEntries(Engine.QA_CRITERIA.map((item) => [item.id, 5]));
  const result = Engine.calculateQaScore(responses);
  assert.equal(result.score, 100);
  assert.equal(result.criticalPass, true);
  assert.equal(result.outcome, 'Pass');
});

test('critical verification failure caps the QA score at 49', () => {
  const responses = Object.fromEntries(Engine.QA_CRITERIA.map((item) => [item.id, 5]));
  responses.verification = 2;
  const result = Engine.calculateQaScore(responses);
  assert.equal(result.rawScore, 88);
  assert.equal(result.score, 49);
  assert.equal(result.criticalPass, false);
  assert.equal(result.outcome, 'Fail');
});

test('ratings are normalized to the supported 1–5 scale', () => {
  const result = Engine.calculateQaScore({ professionalism: 99, verification: 0, listening: 3.4, accuracy: 3, resolution: 4, closure: 5 });
  assert.equal(result.responses.professionalism, 5);
  assert.equal(result.responses.verification, 1);
  assert.equal(result.responses.listening, 3);
  assert.equal(result.outcome, 'Fail');
});

test('evaluation creation requires an interaction and records its score outcome', () => {
  assert.throws(() => Engine.createEvaluation({}), /interaction and agent/);
  const evaluation = Engine.createEvaluation({ interactionId: 'cx-1', agentId: 'ag-1', agent: 'Test Agent', responses: Object.fromEntries(Engine.QA_CRITERIA.map((item) => [item.id, 4])) });
  assert.equal(evaluation.interactionId, 'cx-1');
  assert.equal(evaluation.score, 80);
  assert.equal(evaluation.outcome, 'Coaching required');
});

test('escalation creation validates required interaction and applies safe defaults', () => {
  assert.throws(() => Engine.createEscalation({}), /interaction is required/);
  const escalation = Engine.createEscalation({ interactionId: 'cx-2', priority: 'unexpected', reason: '  Repeat complaint  ' });
  assert.equal(escalation.priority, 'Normal');
  assert.equal(escalation.status, 'Open');
  assert.equal(escalation.reason, 'Repeat complaint');
});

test('metrics reflect active work, unresolved escalations, QA and handled contacts', () => {
  const state = Engine.createInitialState();
  const metrics = Engine.deriveMetrics(state);
  assert.equal(metrics.active, 4);
  assert.equal(metrics.openEscalations, 2);
  assert.equal(metrics.agents, 5);
  assert.equal(metrics.handled, 147);
  assert.equal(metrics.qa, 88);
});

test('interaction filters combine query, channel, status and priority', () => {
  const state = Engine.createInitialState();
  const result = Engine.filterInteractions(state.interactions, { query: 'musa', channel: 'Voice', status: 'Active', priority: 'Urgent' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'cx-74004');
});

test('state save and load preserve supervisor records', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const state = Engine.createInitialState();
  state.coaching.push({ id: 'coach-test', status: 'Open' });
  assert.equal(Engine.saveState(state, storage), true);
  const loaded = Engine.loadState(storage);
  assert.equal(loaded.coaching.length, 1);
  assert.equal(loaded.coaching[0].id, 'coach-test');
});

test('invalid or incompatible stored state falls back to fresh demo data', () => {
  const storage = { getItem: () => '{bad json', setItem: () => {} };
  const loaded = Engine.loadState(storage);
  assert.equal(loaded.version, 47);
  assert.equal(loaded.agents.length, 5);
});

test('activity log is newest-first and bounded to 30 records', () => {
  const state = Engine.createInitialState();
  for (let index = 0; index < 40; index += 1) Engine.addActivity(state, `Activity ${index}`, `10:${String(index).padStart(2, '0')}`);
  assert.equal(state.activity.length, 30);
  assert.equal(state.activity[0].text, 'Activity 39');
  assert.equal(state.activity.at(-1).text, 'Activity 10');
});
