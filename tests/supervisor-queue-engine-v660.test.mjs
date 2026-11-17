import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPERVISOR_QUEUE_VERSION,
  SUPERVISOR_INTAKE_MODES,
  createSupervisorQueueControl,
  normalizeSupervisorQueueControl,
  updateSupervisorQueueControl,
  triageInboundContact,
  triageDigitalContact,
  supervisorQueueBoard
} from '../js/supervisor-queue-engine.js';
import { createLiveQueueState, advanceLiveQueue, liveQueueSnapshot } from '../js/live-queue-engine.js';
import { createInboundQueue, CONTACT_STATUS } from '../js/operations-engine.js';

const inboundScenarios = [
  { id: 'routine', customer: 'Ada Okafor', initials: 'AO', category: 'GENERAL SERVICE', issue: 'Account enquiry' },
  { id: 'fraud', customer: 'Musa Bello', initials: 'MB', category: 'FRAUD SUPPORT', issue: 'Suspicious transaction' }
];

function makeDigital({ id = 'DIG-1', channel = 'live_chat', receivedAt = new Date(0).toISOString(), priority = 'high', slaMinutes = 2 } = {}) {
  return {
    id, channel, channelLabel: channel === 'live_chat' ? 'Live chat' : 'Email', customer: 'Chinwe Okafor',
    subject: 'Cannot sign in', priority, routeGroup: 'Digital Support', status: 'queued', receivedAt,
    slaMinutes, timeline: []
  };
}

test('v6.60 engine exposes supervisor queue controls and bounded demand modes', () => {
  assert.equal(SUPERVISOR_QUEUE_VERSION, '6.60.0');
  assert.deepEqual(Object.keys(SUPERVISOR_INTAKE_MODES), ['normal', 'busy', 'recovery']);
  assert.ok(SUPERVISOR_INTAKE_MODES.busy.multiplier < 1);
  assert.ok(SUPERVISOR_INTAKE_MODES.recovery.multiplier > 1);
});

test('control state defaults to standard intake and normalizes invalid persisted fields safely', () => {
  assert.deepEqual(createSupervisorQueueControl(), {
    version: '6.60.0', paused: false, mode: 'normal', history: [], updatedAt: null, updatedBy: null
  });
  const migrated = normalizeSupervisorQueueControl({ paused: true, mode: 'unknown', history: [{ action: 'paused', reason: 'operator' }] });
  assert.equal(migrated.paused, true);
  assert.equal(migrated.mode, 'normal');
  assert.equal(migrated.history.length, 1);
});

test('pausing intake records a reason and does not mark the shift queue as closed', () => {
  const result = updateSupervisorQueueControl(createSupervisorQueueControl(), 'pause', { actor: 'Shift Lead', reason: 'Clear the existing backlog', now: 1_000 });
  assert.equal(result.changed, true);
  assert.equal(result.control.paused, true);
  assert.equal(result.control.history[0].action, 'intake_paused');
  assert.equal(result.control.history[0].actor, 'Shift Lead');
  assert.equal(result.control.history[0].reason, 'Clear the existing backlog');
});

test('resuming intake reopens arrivals and keeps an auditable control history', () => {
  const paused = updateSupervisorQueueControl(createSupervisorQueueControl(), 'pause', { reason: 'Manage excess demand', now: 1_000 }).control;
  const resumed = updateSupervisorQueueControl(paused, 'resume', { reason: 'Queue backlog cleared', now: 2_000 });
  assert.equal(resumed.control.paused, false);
  assert.equal(resumed.control.history.length, 2);
  assert.equal(resumed.event.action, 'intake_resumed');
});

test('control changes require a meaningful supervisor reason', () => {
  assert.throws(() => updateSupervisorQueueControl(createSupervisorQueueControl(), 'pause', { reason: 'no' }), /at least four characters/i);
});

test('intake demand profile changes are validated and recorded', () => {
  const result = updateSupervisorQueueControl(createSupervisorQueueControl(), 'mode:busy', { reason: 'Cover peak customer arrivals' });
  assert.equal(result.control.mode, 'busy');
  assert.equal(result.event.from, 'normal');
  assert.equal(result.event.to, 'busy');
  assert.throws(() => updateSupervisorQueueControl(result.control, 'mode:extreme', { reason: 'Invalid test mode' }), /valid simulated intake mode/i);
});

test('repeated identical control values are no-ops and do not create duplicate audit events', () => {
  const first = updateSupervisorQueueControl(createSupervisorQueueControl(), 'resume', { reason: 'Keep the normal queue open' });
  assert.equal(first.changed, false);
  assert.equal(first.control.history.length, 0);
});

test('inbound triage changes only queued contacts and records before/after values', () => {
  const queue = createInboundQueue(inboundScenarios, 1, { now: 1_000_000 });
  const contact = queue[0];
  const result = triageInboundContact(queue, contact.id, {
    priority: 'critical', routeGroup: 'Fraud & Security', reason: 'Customer reports possible account compromise'
  }, { actor: 'Shift Lead', now: 1_100_000 });
  assert.equal(result.changed, true);
  assert.equal(contact.priority, 'critical');
  assert.equal(contact.routeGroup, 'Fraud & Security');
  assert.equal(contact.supervisorTriage.actor, 'Shift Lead');
  assert.equal(contact.timeline.at(-1).status, 'supervisor_triaged');
  assert.equal(contact.timeline.at(-1).changes.priority.from, 'normal');
  assert.equal(contact.timeline.at(-1).changes.priority.to, 'critical');
});

test('inbound triage rejects an unknown contact and a contact no longer waiting', () => {
  const queue = createInboundQueue(inboundScenarios, 1, { now: 1_000_000 });
  assert.throws(() => triageInboundContact(queue, 'MISSING', { priority: 'high', reason: 'Escalation review' }), /not found/i);
  queue[0].status = CONTACT_STATUS.CONNECTED;
  assert.throws(() => triageInboundContact(queue, queue[0].id, { priority: 'high', reason: 'Escalation review' }), /only waiting inbound/i);
});

test('triage rejects invalid priority, route and missing reason', () => {
  const queue = createInboundQueue(inboundScenarios, 1, { now: 1_000_000 });
  const id = queue[0].id;
  assert.throws(() => triageInboundContact(queue, id, { priority: 'emergency', reason: 'Urgent risk' }), /valid contact priority/i);
  assert.throws(() => triageInboundContact(queue, id, { routeGroup: 'Mystery Team', reason: 'Wrong routing' }), /supported route group/i);
  assert.throws(() => triageInboundContact(queue, id, { priority: 'high', reason: 'no' }), /at least four characters/i);
});

test('digital triage updates the channel route and preserves the contact conversation timeline', () => {
  const digital = [makeDigital()];
  const contact = digital[0];
  const result = triageDigitalContact(digital, contact.id, {
    priority: 'critical', routeGroup: 'Fraud & Security', reason: 'Customer may have lost account access'
  }, { actor: 'Duty Supervisor', now: 2_000_000 });
  assert.equal(result.changed, true);
  assert.equal(contact.priority, 'critical');
  assert.equal(contact.routeGroup, 'Fraud & Security');
  assert.equal(contact.timeline[0].status, 'supervisor_triaged');
  assert.equal(contact.supervisorTriage.reason, 'Customer may have lost account access');
});

test('digital triage rejects active or completed work', () => {
  const digital = [makeDigital()];
  digital[0].status = 'active';
  assert.throws(() => triageDigitalContact(digital, digital[0].id, { priority: 'high', reason: 'Review active chat' }), /only waiting digital/i);
});

test('supervisor board aggregates voice, digital, SLA risk, escalations and active work', () => {
  const voice = createInboundQueue(inboundScenarios, 2, { now: 0 });
  voice[0].priority = 'critical';
  voice[0].queuedAt = new Date(0).toISOString();
  voice[1].queuedAt = new Date(55_000).toISOString();
  const digital = [makeDigital({ receivedAt: new Date(0).toISOString(), channel: 'live_chat', slaMinutes: 2 })];
  const board = supervisorQueueBoard({
    inboundQueue: voice, digitalQueue: digital,
    supervisorRequests: [{ status: 'open' }, { status: 'resolved' }],
    cases: [{ status: 'Escalated' }, { status: 'Resolved' }],
    currentCall: { id: 'CALL-1' }, activeOutbound: null, digitalActiveId: 'DIG-A',
    voiceNow: 70_000, digitalNow: 100_000
  });
  assert.equal(board.voiceWaiting, 2);
  assert.equal(board.digitalWaiting, 1);
  assert.equal(board.totalWaiting, 3);
  assert.equal(board.slaAtRisk, 2);
  assert.equal(board.openRequests, 1);
  assert.equal(board.escalatedCases, 1);
  assert.equal(board.activeWork, 2);
  assert.equal(board.priorityCounts.critical, 2);
  assert.equal(board.voice[0].slaAtRisk, true);
  assert.equal(board.digital[0].slaAtRisk, true);
});

test('board excludes non-waiting contacts and preserves voice and digital clocks independently', () => {
  const voice = [{ id: 'V1', status: 'queued', priority: 'normal', queuedAt: new Date(10_000).toISOString() }, { id: 'V2', status: 'connected', priority: 'critical', queuedAt: new Date(0).toISOString() }];
  const digital = [makeDigital({ id: 'D1', receivedAt: new Date(20_000).toISOString() }), { ...makeDigital({ id: 'D2' }), status: 'resolved' }];
  const board = supervisorQueueBoard({ inboundQueue: voice, digitalQueue: digital, voiceNow: 60_000, digitalNow: 100_000 });
  assert.equal(board.voiceWaiting, 1);
  assert.equal(board.digitalWaiting, 1);
  assert.equal(board.voice[0].waitSeconds, 50);
  assert.equal(board.digital[0].waitSeconds, 80);
});

test('paused live queue stops automatic arrivals but still processes existing customer patience', () => {
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 0, seed: 3 });
  queueState.paused = true;
  const queue = createInboundQueue(inboundScenarios, 1, { now: 0 });
  queue[0].priority = 'low';
  queue[0].patienceMinutes = 16;
  const result = advanceLiveQueue({
    queueState, queue, scenarios: inboundScenarios, day: 1,
    elapsedMinute: 20, now: 20 * 60_000, sequence: 2
  });
  assert.equal(result.arrivals.length, 0);
  assert.equal(result.abandonments.length, 1);
  assert.equal(result.queueState.active, true);
  assert.equal(result.queueState.paused, true);
  assert.equal(liveQueueSnapshot(result.queueState, 20).nextArrivalInMinutes, null);
});

test('intake mode multiplier changes the next scheduled arrival interval', () => {
  const base = createLiveQueueState({ day: 1, elapsedMinute: 0, seed: 12 });
  const busy = structuredClone(base);
  busy.arrivalIntervalMultiplier = SUPERVISOR_INTAKE_MODES.busy.multiplier;
  const recovery = structuredClone(base);
  recovery.arrivalIntervalMultiplier = SUPERVISOR_INTAKE_MODES.recovery.multiplier;
  const run = queueState => advanceLiveQueue({
    queueState, queue: [], scenarios: inboundScenarios, day: 1,
    elapsedMinute: 40, now: 40 * 60_000, sequence: 0
  });
  const baseResult = run(base).queueState.nextArrivalAtMinute;
  const busyResult = run(busy).queueState.nextArrivalAtMinute;
  const recoveryResult = run(recovery).queueState.nextArrivalAtMinute;
  assert.ok(busyResult < baseResult);
  assert.ok(recoveryResult > baseResult);
});
