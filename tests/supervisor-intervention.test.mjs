import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSupervisorQueue,
  enqueueSupervisorEscalation,
  beginNextSupervisorIntervention,
  setSupervisorPhase,
  finishSupervisorIntervention,
  disposeSupervisorQueue,
  SUPERVISOR_PHASES
} from '../js/supervisor-intervention-core.js';
import { calloriaSupervisorInterventionPlugin } from '../build/calloria-supervisor-intervention-plugin.js';
import { calloriaSupervisorCaseBridgePlugin } from '../build/calloria-supervisor-case-bridge-plugin.js';

const READY = 'let customerWorldLayer = null;';
const UPDATE = 'customerWorldLayer?.update?.(delta);';
const DISPOSE = 'customerWorldLayer?.dispose?.();';
function sampleWorld() {
  return `import { attachCalloriaWorldCustomers } from './customer-world-integration.js';\nconst __CALLORIA_RECEPTION_CUSTOMER_WORLD_V16__ = true;\nexport async function initProductionWorld(THREE, host, callbacks = {}) {\n  const scene = {}; const tier = 'balanced';\n  ${READY}\n  function update(delta) {\n    ${UPDATE}\n  }\n  function dispose() {\n    ${DISPOSE}\n    scene.traverse(() => {});\n  }\n}`;
}

test('queue rejects missing scenario ids and accepts a real escalation', () => {
  const queue = createSupervisorQueue();
  assert.equal(enqueueSupervisorEscalation(queue, {}).accepted, false);
  const result = enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-1', emotion: 'angry', turn: 3 });
  assert.equal(result.accepted, true);
  assert.equal(result.shouldStart, true);
});

test('queue deduplicates active and pending scenarios', () => {
  const queue = createSupervisorQueue();
  enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-1' });
  beginNextSupervisorIntervention(queue);
  assert.equal(enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-1' }).reason, 'duplicate');
  enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-2' });
  assert.equal(enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-2' }).reason, 'duplicate');
  assert.equal(queue.pending.length, 1);
});

test('only one escalation is active and queued case starts after finish', () => {
  const queue = createSupervisorQueue();
  enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-1' });
  enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-2' });
  assert.equal(beginNextSupervisorIntervention(queue).scenarioId, 'CIL-1');
  assert.equal(beginNextSupervisorIntervention(queue), null);
  finishSupervisorIntervention(queue, 'CIL-1');
  assert.equal(beginNextSupervisorIntervention(queue).scenarioId, 'CIL-2');
});

test('phase transitions require the active scenario and a known phase', () => {
  const queue = createSupervisorQueue();
  enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-1' });
  beginNextSupervisorIntervention(queue);
  assert.equal(setSupervisorPhase(queue, 'CIL-2', SUPERVISOR_PHASES.ASSISTING), false);
  assert.equal(setSupervisorPhase(queue, 'CIL-1', SUPERVISOR_PHASES.ASSISTING), true);
  assert.equal(queue.active.phase, 'assisting');
});

test('completed scenarios cannot be queued again, while a resumed case can be re-escalated', () => {
  const queue = createSupervisorQueue();
  enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-1' });
  beginNextSupervisorIntervention(queue);
  finishSupervisorIntervention(queue, 'CIL-1');
  assert.equal(enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-1' }).reason, 'already-completed');
  const resumed = createSupervisorQueue();
  enqueueSupervisorEscalation(resumed, { scenarioId: 'CIL-2' });
  beginNextSupervisorIntervention(resumed);
  finishSupervisorIntervention(resumed, 'CIL-2', { markCompleted: false });
  assert.equal(enqueueSupervisorEscalation(resumed, { scenarioId: 'CIL-2' }).accepted, true);
});

test('dispose clears pending work and blocks future escalations', () => {
  const queue = createSupervisorQueue();
  enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-1' });
  disposeSupervisorQueue(queue);
  assert.equal(queue.disposed, true);
  assert.equal(queue.pending.length, 0);
  assert.equal(enqueueSupervisorEscalation(queue, { scenarioId: 'CIL-2' }).reason, 'disposed');
});

test('Vite plugin adds supervisor attach, update and dispose lifecycle hooks', () => {
  const plugin = calloriaSupervisorInterventionPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, sampleWorld(), '/repo/js/production-world.js');
  assert.match(result.code, /attachCalloriaSupervisorIntervention/);
  assert.match(result.code, /supervisorInterventionLayer\?\.update\?\.\(delta\)/);
  assert.match(result.code, /supervisorInterventionDisposed = true/);
});

test('Vite plugin ignores unrelated modules and is idempotent', () => {
  const plugin = calloriaSupervisorInterventionPlugin();
  assert.equal(plugin.transform.call({}, 'export const x = 1;', '/repo/js/other.js'), null);
  const source = sampleWorld();
  const first = plugin.transform.call({ error(message) { throw new Error(message); } }, source, '/repo/js/production-world.js');
  assert.equal(plugin.transform.call({}, first.code, '/repo/js/production-world.js'), null);
});

test('Vite plugin refuses missing or duplicate integration anchors', () => {
  const plugin = calloriaSupervisorInterventionPlugin();
  assert.throws(() => plugin.transform.call({ error(message) { throw new Error(message); } }, 'export const bad = true;', '/repo/js/production-world.js'), /requires the existing customer-world integration plugin/);
  const malformed = sampleWorld().replace(READY, `${READY}\n${READY}`);
  assert.throws(() => plugin.transform.call({ error(message) { throw new Error(message); } }, malformed, '/repo/js/production-world.js'), /expected exactly one customer-world initialisation anchor/);
});


test('main application bridge persists a supervisor disposition without closing mandatory QA status', () => {
  const plugin = calloriaSupervisorCaseBridgePlugin();
  const mainSource = `let state = loadState();
function saveState() {}
function pushOperationEvent(type, reference, message, status = 'recorded', details = {}) {}
function renderView() {}
function toast(message, type = 'info') {}`;
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, mainSource, '/repo/js/main.js');
  assert.match(result.code, /calloria:supervisor-case-recorded/);
  assert.match(result.code, /session\.status !== 'escalated'/);
  assert.match(result.code, /mandatory QA review remains open/);
  assert.match(result.code, /saveState\(\)/);
});

test('main application bridge ignores unrelated modules and is idempotent', () => {
  const plugin = calloriaSupervisorCaseBridgePlugin();
  assert.equal(plugin.transform.call({}, 'export const x = 1;', '/repo/js/not-main.js'), null);
  const source = `let state = loadState();
function saveState() {}
function pushOperationEvent(type, reference, message, status = 'recorded', details = {}) {}`;
  const first = plugin.transform.call({ error(message) { throw new Error(message); } }, source, '/repo/js/main.js');
  assert.equal(plugin.transform.call({}, first.code, '/repo/js/main.js'), null);
});

test('main application bridge refuses an incompatible source instead of patching partially', () => {
  const plugin = calloriaSupervisorCaseBridgePlugin();
  assert.throws(() => plugin.transform.call({ error(message) { throw new Error(message); } }, 'const state = {};', '/repo/js/main.js'), /expected exactly one main application state anchor/);
});
