import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDigitalLiveQueueState,
  normalizeDigitalLiveQueueState,
  advanceDigitalLiveQueue,
  digitalLiveQueueSnapshot,
  setDigitalQueueDemandMultiplier,
  DIGITAL_LIVE_QUEUE_POLICY
} from '../js/digital-live-queue-engine.js';
import { DIGITAL_SCENARIOS, DIGITAL_STATUS } from '../js/multichannel-engine.js';

const NOW = Date.parse('2026-11-17T09:00:00.000Z');

function queuedEmail(id) {
  return { id, channel: 'email', status: DIGITAL_STATUS.QUEUED, receivedAt: new Date(NOW).toISOString() };
}

test('digital live queue starts with deterministic channel-specific arrival schedules', () => {
  const state = createDigitalLiveQueueState({ day: 2, elapsedMinute: 10, seed: 45 });
  assert.equal(state.day, 2);
  assert.equal(state.active, true);
  assert.equal(state.openingBatchSeeded, false);
  assert.deepEqual(Object.keys(state.nextArrivalAtMinute).sort(), ['email', 'live_chat', 'social']);
  assert.equal(state.nextArrivalAtMinute.email, 24);
  assert.equal(state.nextArrivalAtMinute.live_chat, 16);
  assert.equal(state.nextArrivalAtMinute.social, 20);
});

test('one advance creates automatic email, live-chat and social contacts when each channel is due', () => {
  const queue = [];
  const state = createDigitalLiveQueueState({ day: 1, elapsedMinute: 0, seed: 7 });
  const result = advanceDigitalLiveQueue({ queueState: state, queue, scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 15, now: NOW, sequence: 0 });
  assert.equal(result.arrivals.length, 3);
  assert.deepEqual(result.arrivals.map(item => item.channel).sort(), ['email', 'live_chat', 'social']);
  assert.equal(queue.length, 3);
  assert.equal(result.queueState.arrivals, 3);
  assert.deepEqual(result.queueState.arrivalsByChannel, { email: 1, live_chat: 1, social: 1 });
  assert.ok(result.arrivals.every(item => item.source === 'automatic_shift_arrival'));
  assert.ok(result.arrivals.every(item => item.receivedAt === new Date(NOW).toISOString()));
  assert.equal(result.nextSequence, 3);
});

test('automatic arrivals use configured organisation digital response target', () => {
  const result = advanceDigitalLiveQueue({
    queueState: createDigitalLiveQueueState({ day: 1, seed: 3 }), queue: [], scenarios: DIGITAL_SCENARIOS,
    day: 1, elapsedMinute: 15, now: NOW, sequence: 8, slaMinutesOverride: 55
  });
  assert.equal(result.arrivals.length, 3);
  assert.ok(result.arrivals.every(item => item.slaMinutes === 55));
});

test('waiting capacity is channel-specific and overflow is recorded without creating a contact', () => {
  const queue = Array.from({ length: DIGITAL_LIVE_QUEUE_POLICY.channels.email.maxWaiting }, (_, index) => queuedEmail(`E-${index}`));
  const state = createDigitalLiveQueueState({ day: 1, seed: 12 });
  const result = advanceDigitalLiveQueue({ queueState: state, queue, scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 15, now: NOW, sequence: 0 });
  assert.equal(result.overflows.length, 1);
  assert.equal(result.overflows[0].channel, 'email');
  assert.equal(result.queueState.overflowedByChannel.email, 1);
  assert.equal(result.arrivals.length, 2);
  assert.equal(queue.filter(item => item.status === DIGITAL_STATUS.QUEUED && item.channel === 'email').length, DIGITAL_LIVE_QUEUE_POLICY.channels.email.maxWaiting);
});

test('active and resolved digital contacts do not consume waiting-channel capacity', () => {
  const queue = [
    { ...queuedEmail('ACTIVE'), status: DIGITAL_STATUS.ACTIVE },
    { ...queuedEmail('RESOLVED'), status: DIGITAL_STATUS.RESOLVED }
  ];
  const result = advanceDigitalLiveQueue({ queueState: createDigitalLiveQueueState({ day: 1, seed: 12 }), queue, scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 15, now: NOW, sequence: 0 });
  assert.ok(result.arrivals.some(item => item.channel === 'email'));
  assert.equal(result.overflows.some(item => item.channel === 'email'), false);
});

test('demand profiles adjust subsequent digital arrival intervals within safe bounds', () => {
  const base = createDigitalLiveQueueState({ day: 1, seed: 19 });
  const busy = setDigitalQueueDemandMultiplier(base, 0.72);
  const recovery = setDigitalQueueDemandMultiplier(base, 1.42);
  const baseResult = advanceDigitalLiveQueue({ queueState: base, queue: [], scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 15, now: NOW, sequence: 0 });
  const busyResult = advanceDigitalLiveQueue({ queueState: busy, queue: [], scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 15, now: NOW, sequence: 0 });
  const recoveryResult = advanceDigitalLiveQueue({ queueState: recovery, queue: [], scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 15, now: NOW, sequence: 0 });
  for (const channel of ['email', 'live_chat', 'social']) {
    assert.ok(busyResult.queueState.nextArrivalAtMinute[channel] < baseResult.queueState.nextArrivalAtMinute[channel]);
    assert.ok(recoveryResult.queueState.nextArrivalAtMinute[channel] > baseResult.queueState.nextArrivalAtMinute[channel]);
  }
});

test('same-minute calls do not replay missed arrivals as a catch-up burst', () => {
  const state = createDigitalLiveQueueState({ day: 1, seed: 25 });
  const first = advanceDigitalLiveQueue({ queueState: state, queue: [], scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 90, now: NOW, sequence: 0 });
  const second = advanceDigitalLiveQueue({ queueState: first.queueState, queue: [], scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 90, now: NOW, sequence: first.nextSequence });
  assert.equal(first.arrivals.length, 3);
  assert.equal(second.arrivals.length, 0);
});

test('closed digital intake never creates new contacts', () => {
  const state = { ...createDigitalLiveQueueState({ day: 1 }), active: false };
  const result = advanceDigitalLiveQueue({ queueState: state, queue: [], scenarios: DIGITAL_SCENARIOS, day: 1, elapsedMinute: 100, now: NOW, sequence: 0 });
  assert.equal(result.arrivals.length, 0);
  assert.equal(result.queueState.active, false);
});

test('legacy or malformed saved digital queue state is safely normalised', () => {
  const state = normalizeDigitalLiveQueueState({ day: 1, nextArrivalAtMinute: { email: -2 }, arrivals: -9, arrivalsByChannel: { email: 'bad' }, arrivalIntervalMultiplier: 99 }, { day: 1, elapsedMinute: 5, seed: 4 });
  assert.equal(state.nextArrivalAtMinute.email, 0);
  assert.equal(state.arrivals, 0);
  assert.equal(state.arrivalsByChannel.email, 0);
  assert.equal(state.arrivalIntervalMultiplier, 2);
  assert.equal(state.openingBatchSeeded, false);
});

test('a different workday receives a clean schedule and counters', () => {
  const old = createDigitalLiveQueueState({ day: 1, seed: 5 });
  old.arrivals = 20;
  old.arrivalsByChannel.email = 10;
  const next = normalizeDigitalLiveQueueState(old, { day: 2, elapsedMinute: 0, seed: 5 });
  assert.equal(next.day, 2);
  assert.equal(next.arrivals, 0);
  assert.equal(next.arrivalsByChannel.email, 0);
  assert.equal(next.active, true);
});

test('snapshot reports independent per-channel arrivals, overflow and the next due contact', () => {
  const state = createDigitalLiveQueueState({ day: 3, elapsedMinute: 10, seed: 1 });
  state.arrivals = 6;
  state.arrivalsByChannel = { email: 1, live_chat: 3, social: 2 };
  state.overflowed = 2;
  state.overflowedByChannel.email = 2;
  const snapshot = digitalLiveQueueSnapshot(state, 10);
  assert.equal(snapshot.arrivals, 6);
  assert.equal(snapshot.arrivalsByChannel.live_chat, 3);
  assert.equal(snapshot.overflowed, 2);
  assert.equal(snapshot.nextArrivalInMinutes, 6);
});

test('missing digital live queue state is reported as stopped, not active', () => {
  const snapshot = digitalLiveQueueSnapshot(null, 30);
  assert.equal(snapshot.active, false);
  assert.equal(snapshot.arrivals, 0);
  assert.equal(snapshot.nextArrivalInMinutes, null);
});
