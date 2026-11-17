import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_QUEUE_VERSION,
  DEFAULT_LIVE_QUEUE_POLICY,
  createLiveQueueState,
  normalizeLiveQueueState,
  stampInboundQueue,
  advanceLiveQueue,
  liveQueueSnapshot,
  addManualDemandSurge,
  customerPatienceMinutes
} from '../js/live-queue-engine.js';
import { CONTACT_STATUS, createInboundQueue, countQueuedContacts } from '../js/operations-engine.js';

const scenarios = [
  { id: 'routine-service', customer: 'Ada Okafor', initials: 'AO', category: 'GENERAL SERVICE', issue: 'Service enquiry' },
  { id: 'suspicious-transaction', customer: 'Musa Bello', initials: 'MB', category: 'FRAUD SUPPORT', issue: 'Suspicious transaction' },
  { id: 'card-decline', customer: 'Zainab Yusuf', initials: 'ZY', category: 'CARD SERVICES', issue: 'Card declined' }
];

function advance(queueState, queue = [], elapsedMinute = 8, sequence = 0, policy = DEFAULT_LIVE_QUEUE_POLICY) {
  const epoch = 1_000_000;
  return advanceLiveQueue({
    queueState,
    queue,
    scenarios,
    day: 1,
    elapsedMinute,
    now: epoch + elapsedMinute * 60_000,
    sequence,
    policy
  });
}

test('v6.59 engine identifies the live queue release and has bounded demand policy', () => {
  assert.equal(LIVE_QUEUE_VERSION, '6.59.0');
  assert.equal(DEFAULT_LIVE_QUEUE_POLICY.maxWaiting, 24);
  assert.equal(DEFAULT_LIVE_QUEUE_POLICY.maxArrivalsPerAdvance, 3);
});

test('customer patience differs by priority', () => {
  assert.equal(customerPatienceMinutes('critical'), 24);
  assert.equal(customerPatienceMinutes('high'), 21);
  assert.equal(customerPatienceMinutes('normal'), 19);
  assert.equal(customerPatienceMinutes('low'), 16);
});

test('opening contacts are stamped against the accelerated shift clock', () => {
  const now = 5_000_000;
  const contacts = createInboundQueue(scenarios, 3, { now, sequence: 0 });
  stampInboundQueue(contacts, { now, elapsedMinute: 40, source: 'opening_queue' });
  assert.equal(contacts[0].source, 'opening_queue');
  assert.equal(contacts[0].simArrivalMinute, 39.1);
  assert.equal(contacts[2].simArrivalMinute, 40);
  assert.equal(Date.parse(contacts[2].queuedAt), now);
  assert.ok(contacts.every(contact => Number.isFinite(contact.patienceMinutes)));
});

test('no automatic arrival is generated before the scheduled first arrival', () => {
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 0, seed: 11 });
  const result = advanceLiveQueue({ queueState, queue: [], scenarios, day: 1, elapsedMinute: 7, now: 1_420_000, sequence: 0 });
  assert.equal(result.arrivals.length, 0);
  assert.equal(result.queueState.arrivals, 0);
  assert.equal(result.nextSequence, 0);
});

test('an automatic contact enters the queue at the scheduled arrival time', () => {
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 0, seed: 11 });
  const now = 1_000_000 + 7.5 * 60_000;
  const result = advanceLiveQueue({ queueState, queue: [], scenarios, day: 1, elapsedMinute: 7.5, now, sequence: 4 });
  assert.equal(result.arrivals.length, 1);
  assert.equal(result.nextSequence, 5);
  assert.equal(result.arrivals[0].status, CONTACT_STATUS.QUEUED);
  assert.equal(result.arrivals[0].source, 'live_arrival');
  assert.equal(Date.parse(result.arrivals[0].queuedAt), now);
  assert.equal(result.queueState.arrivals, 1);
});

test('the same initial seed produces the same arrival schedule and priority sequence', () => {
  const a = createLiveQueueState({ day: 2, elapsedMinute: 0, seed: 123 });
  const b = structuredClone(a);
  const queueA = [];
  const queueB = [];
  let resultA = advance(a, queueA, 8, 0);
  let resultB = advance(b, queueB, 8, 0);
  assert.deepEqual(resultA.arrivals.map(x => [x.scenarioId, x.priority, x.queuedAt]), resultB.arrivals.map(x => [x.scenarioId, x.priority, x.queuedAt]));
  resultA = advance(resultA.queueState, queueA, 30, resultA.nextSequence);
  resultB = advance(resultB.queueState, queueB, 30, resultB.nextSequence);
  assert.deepEqual(resultA.arrivals.map(x => [x.scenarioId, x.priority, x.queuedAt]), resultB.arrivals.map(x => [x.scenarioId, x.priority, x.queuedAt]));
  assert.equal(resultA.queueState.seed, resultB.queueState.seed);
});

test('an unserved low-priority customer abandons after the patience threshold', () => {
  const [waiting] = createInboundQueue(scenarios, 1, { now: 0, sequence: 20 });
  waiting.priority = 'low';
  waiting.patienceMinutes = 16;
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 17, seed: 7 });
  const result = advanceLiveQueue({
    queueState,
    queue: [waiting],
    scenarios,
    day: 1,
    elapsedMinute: 17,
    now: 17 * 60_000,
    sequence: 21
  });
  assert.equal(result.abandonments.length, 1);
  assert.equal(waiting.status, CONTACT_STATUS.ABANDONED);
  assert.equal(result.queueState.abandoned, 1);
  assert.equal(countQueuedContacts([waiting]), 0);
});

test('the simulator applies a hard waiting-queue capacity and records overflow', () => {
  const queue = createInboundQueue(scenarios, 24, { now: 1_000_000, sequence: 0 });
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 0, seed: 9 });
  const result = advance(queueState, queue, 8, 24);
  assert.equal(result.arrivals.length, 0);
  assert.equal(result.nextSequence, 24);
  assert.equal(result.queueState.overflowed, 1);
  assert.equal(countQueuedContacts(queue), 24);
});

test('a large clock jump is bounded to three arrivals per engine advance', () => {
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 0, seed: 45 });
  const result = advance(queueState, [], 80, 0);
  assert.equal(result.arrivals.length, 3);
  assert.equal(result.queueState.arrivals, 3);
});

test('queue state migration resets a prior day but preserves current-day counters', () => {
  const existing = { day: 3, seed: 8, nextArrivalAtMinute: 42, arrivals: 12, abandoned: 2, overflowed: 1, active: true, lastProcessedMinute: 20 };
  const current = normalizeLiveQueueState(existing, { day: 3, elapsedMinute: 21, seed: 5 });
  assert.equal(current.arrivals, 12);
  assert.equal(current.abandoned, 2);
  assert.equal(current.nextArrivalAtMinute, 42);
  const nextDay = normalizeLiveQueueState(existing, { day: 4, elapsedMinute: 0, seed: 5 });
  assert.equal(nextDay.arrivals, 0);
  assert.equal(nextDay.abandoned, 0);
  assert.equal(nextDay.day, 4);
});

test('queue automatically closes at the end of the scheduled nine-hour shift', () => {
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 539, seed: 10 });
  const result = advance(queueState, [], 540, 0);
  assert.equal(result.arrivals.length, 0);
  assert.equal(result.queueState.active, false);
  assert.equal(liveQueueSnapshot(result.queueState, 540).nextArrivalInMinutes, null);
});

test('a closed shift cannot create arrivals or abandon customers', () => {
  const [waiting] = createInboundQueue(scenarios, 1, { now: 0 });
  waiting.priority = 'low';
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 0, seed: 13 });
  queueState.active = false;
  const result = advance(queueState, [waiting], 30, 1);
  assert.equal(result.arrivals.length, 0);
  assert.equal(result.abandonments.length, 0);
  assert.equal(waiting.status, CONTACT_STATUS.QUEUED);
});

test('opening, automatic and manual arrivals are reported as separate workload sources', async () => {
  const { liveQueueSnapshot } = await import('../js/live-queue-engine.js');
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 0, seed: 19 });
  queueState.openingContacts = 6;
  queueState.manualContacts = 12;
  queueState.arrivals = 3;
  const metrics = liveQueueSnapshot(queueState, 10);
  assert.equal(metrics.arrivals, 3);
  assert.equal(metrics.openingContacts, 6);
  assert.equal(metrics.manualContacts, 12);
  assert.equal(metrics.totalArrivals, 21);
});


test('manual demand surges are admitted only up to the same 24-contact waiting cap', () => {
  const queue = createInboundQueue(scenarios, 21, { now: 8_000_000, sequence: 0 });
  const queueState = createLiveQueueState({ day: 1, elapsedMinute: 35, seed: 28 });
  const result = addManualDemandSurge({
    queue, scenarios, count: 6, day: 1, elapsedMinute: 35, now: 8_000_000, sequence: 21, queueState
  });
  assert.equal(result.requested, 6);
  assert.equal(result.admitted, 3);
  assert.equal(result.overflowed, 3);
  assert.equal(countQueuedContacts(queue), 24);
  assert.equal(result.queueState.manualContacts, 3);
  assert.equal(result.queueState.overflowed, 3);
  assert.equal(result.nextSequence, 24);
  assert.ok(result.contacts.every(item => item.source === 'manual_demand_surge'));
});
