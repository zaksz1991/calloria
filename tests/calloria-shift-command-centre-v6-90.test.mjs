import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShiftCommandSnapshot,
  buildShiftCommandPanelHTML,
  SHIFT_COMMAND_VERSION
} from '../js/calloria-shift-command-centre-v6-90.mjs';

const epoch = Date.parse('2026-11-21T09:00:00.000Z');
const activeState = overrides => ({
  shiftActive: true,
  day: 1,
  simulationClockSeconds: 9 * 3600 + 30 * 60,
  shiftElapsedMinutes: 30,
  shiftSimulationEpochMs: epoch,
  agentStatus: 'available',
  nameInitials: 'AZ',
  inboundQueueItems: [],
  digitalQueue: [],
  callbacks: [],
  cases: [],
  supervisorRequests: [],
  ...overrides
});

test('declares the expected command-centre version', () => {
  assert.equal(SHIFT_COMMAND_VERSION, '6.90.0');
});

test('hides work priorities when no shift is active', () => {
  const snapshot = buildShiftCommandSnapshot({ shiftActive: false });
  assert.equal(snapshot.active, false);
  assert.equal(snapshot.tasks.length, 0);
  assert.match(snapshot.recommendation, /Start a shift/);
});

test('ranks critical inbound work above normal work and includes queue wait age', () => {
  const state = activeState({
    inboundQueueItems: [
      { id: 'INB-N', status: 'queued', priority: 'normal', customer: 'Normal Customer', issue: 'General enquiry', queuedAt: new Date(epoch + 29 * 60_000).toISOString() },
      { id: 'INB-C', status: 'queued', priority: 'critical', customer: 'Critical Customer', issue: 'Suspicious account activity', queuedAt: new Date(epoch + 29 * 60_000).toISOString() }
    ]
  });
  const snapshot = buildShiftCommandSnapshot(state, { now: epoch + 30 * 60_000 });
  assert.equal(snapshot.metrics.inboundWaiting, 2);
  assert.equal(snapshot.tasks[0].id, 'INB-C');
  assert.match(snapshot.tasks[0].detail, /waiting 60s/);
  assert.equal(snapshot.tasks[0].status, 'WAIT TARGET EXCEEDED');
});

test('uses existing digital first-response SLA rules for queued work', () => {
  const state = activeState({
    digitalQueue: [{
      id: 'DIG-1', status: 'queued', channel: 'live_chat', channelLabel: 'Live chat',
      customer: 'Chinwe Okafor', subject: 'Cannot sign in', priority: 'high',
      slaMinutes: 2, receivedAt: new Date(epoch + 25 * 60_000).toISOString()
    }]
  });
  const snapshot = buildShiftCommandSnapshot(state, { now: epoch + 30 * 60_000 });
  assert.equal(snapshot.metrics.digitalWaiting, 1);
  assert.equal(snapshot.tasks[0].kind, 'digital');
  assert.equal(snapshot.tasks[0].meta.slaStatus, 'breached');
  assert.equal(snapshot.tasks[0].status, 'SLA breached');
});

test('does not expose unrelated agents’ active digital conversations', () => {
  const state = activeState({ digitalQueue: [
    { id: 'DIG-OTHER', status: 'active', assignedTo: 'EMP-OTHER', customer: 'Other', receivedAt: new Date(epoch).toISOString() },
    { id: 'DIG-MINE', status: 'active', assignedTo: 'EMP-AZ', customer: 'Mine', receivedAt: new Date(epoch).toISOString() }
  ] });
  const snapshot = buildShiftCommandSnapshot(state, { now: epoch + 30 * 60_000 });
  assert.equal(snapshot.tasks.length, 1);
  assert.equal(snapshot.tasks[0].id, 'DIG-MINE');
});

test('includes only scheduled callbacks whose due timestamp has arrived', () => {
  const state = activeState({ callbacks: [
    { id: 'CBK-DUE', status: 'scheduled', type: 'inbound', customer: 'Due Customer', dueAt: new Date(epoch + 20 * 60_000).toISOString() },
    { id: 'CBK-FUTURE', status: 'scheduled', type: 'inbound', customer: 'Future Customer', dueAt: new Date(epoch + 40 * 60_000).toISOString() },
    { id: 'CBK-DONE', status: 'completed', type: 'inbound', customer: 'Completed Customer', dueAt: new Date(epoch).toISOString() }
  ] });
  const snapshot = buildShiftCommandSnapshot(state, { now: epoch + 30 * 60_000 });
  assert.equal(snapshot.metrics.callbacksDue, 1);
  assert.equal(snapshot.tasks[0].id, 'CBK-DUE');
  assert.equal(snapshot.tasks[0].targetView, 'queue');
});

test('prioritises an overdue reopened case follow-up using the simulator clock', () => {
  const state = activeState({ cases: [{
    reference: 'CASE-22', customer: 'Amina Yusuf', title: 'Duplicate debit',
    lifecycle: { followUp: { id: 'CFU-22', status: 'open', priority: 'urgent', dueDay: 1, dueMinute: 9 * 60 + 10, owner: 'Agent' } }
  }] });
  const snapshot = buildShiftCommandSnapshot(state, { now: epoch + 30 * 60_000 });
  assert.equal(snapshot.metrics.caseFollowUps, 1);
  assert.equal(snapshot.tasks[0].kind, 'case-followup');
  assert.equal(snapshot.tasks[0].status, 'OVERDUE');
  assert.match(snapshot.tasks[0].detail, /20 simulated min overdue/);
});

test('shows open supervisor requests as explicit review work', () => {
  const state = activeState({ supervisorRequests: [
    { id: 'SUP-1', status: 'open', customer: 'Customer A', reason: 'Review a sensitive case' },
    { id: 'SUP-2', status: 'closed', customer: 'Customer B', reason: 'Already reviewed' }
  ] });
  const snapshot = buildShiftCommandSnapshot(state, { now: epoch + 30 * 60_000 });
  assert.equal(snapshot.metrics.supervisorRequests, 1);
  assert.equal(snapshot.tasks[0].targetView, 'supervisor');
});

test('forces active interaction and wrap-up work to the top of the list', () => {
  const callState = activeState({ currentCall: { id: 'CALL-1' }, inboundQueueItems: [
    { id: 'INB-1', status: 'queued', priority: 'critical', queuedAt: new Date(epoch).toISOString() }
  ] });
  const callSnapshot = buildShiftCommandSnapshot(callState, { now: epoch + 30 * 60_000 });
  assert.equal(callSnapshot.tasks[0].kind, 'active-interaction');

  const wrapSnapshot = buildShiftCommandSnapshot(activeState({ wrapUp: { reference: 'WRAP-1' } }), { now: epoch + 30 * 60_000 });
  assert.equal(wrapSnapshot.tasks[0].title, 'Complete after-contact work');
  assert.equal(wrapSnapshot.tasks[0].status, 'ACTION REQUIRED');
});

test('does not mutate the saved application state', () => {
  const state = activeState({ inboundQueueItems: [{ id: 'INB-1', status: 'queued', priority: 'high', queuedAt: new Date(epoch).toISOString() }] });
  const before = JSON.stringify(state);
  buildShiftCommandSnapshot(state, { now: epoch + 30 * 60_000 });
  assert.equal(JSON.stringify(state), before);
});

test('builds accessible escaped panel markup with existing navigation targets', () => {
  const snapshot = buildShiftCommandSnapshot(activeState({ inboundQueueItems: [
    { id: 'INB-X', status: 'queued', priority: 'normal', customer: '<img src=x>', issue: 'Help & support', queuedAt: new Date(epoch).toISOString() }
  ] }), { now: epoch + 30 * 60_000 });
  const html = buildShiftCommandPanelHTML(snapshot);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /data-command-navigate="queue"/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img src=x>/);
});
