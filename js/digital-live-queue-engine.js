/**
 * CALLORIA v6.61 — deterministic, multi-channel digital workload arrivals.
 * All generated contacts are fictional local gameplay records. This module
 * does not connect to live email, chat, social accounts or external providers.
 */
import { DIGITAL_CHANNELS, DIGITAL_STATUS, createDigitalQueue } from './multichannel-engine.js';

export const DIGITAL_LIVE_QUEUE_VERSION = '6.61.0';
export const DIGITAL_LIVE_QUEUE_POLICY = Object.freeze({
  maxArrivalsPerAdvance: 3,
  channels: Object.freeze({
    email: Object.freeze({ firstArrivalMinute: 14, intervalMinutes: 42, jitterMinutes: 8, maxWaiting: 18 }),
    live_chat: Object.freeze({ firstArrivalMinute: 6, intervalMinutes: 20, jitterMinutes: 4, maxWaiting: 14 }),
    social: Object.freeze({ firstArrivalMinute: 10, intervalMinutes: 31, jitterMinutes: 6, maxWaiting: 16 })
  })
});

const CHANNEL_KEYS = Object.freeze(Object.keys(DIGITAL_CHANNELS));

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveSeed(value) {
  const seed = Math.floor(Math.abs(finite(value, 1))) >>> 0;
  return seed || 1;
}

function nextRandom(seed) {
  const nextSeed = (Math.imul(1664525, positiveSeed(seed)) + 1013904223) >>> 0;
  return { seed: nextSeed || 1, value: nextSeed / 0xffffffff };
}

function safeCounter(value) {
  return Math.max(0, Math.floor(finite(value, 0)));
}

function defaultNextArrivals(elapsedMinute, policy = DIGITAL_LIVE_QUEUE_POLICY) {
  return Object.fromEntries(CHANNEL_KEYS.map(channel => [
    channel,
    Math.max(0, finite(elapsedMinute, 0)) + policy.channels[channel].firstArrivalMinute
  ]));
}

export function createDigitalLiveQueueState({ day = 1, elapsedMinute = 0, seed = 1 } = {}) {
  const safeDay = Math.max(1, Math.floor(finite(day, 1)));
  const minute = Math.max(0, finite(elapsedMinute, 0));
  return {
    version: DIGITAL_LIVE_QUEUE_VERSION,
    day: safeDay,
    seed: positiveSeed(seed + safeDay * 104729),
    nextArrivalAtMinute: defaultNextArrivals(minute),
    arrivals: 0,
    openingBatchSeeded: false,
    arrivalsByChannel: Object.fromEntries(CHANNEL_KEYS.map(channel => [channel, 0])),
    overflowed: 0,
    overflowedByChannel: Object.fromEntries(CHANNEL_KEYS.map(channel => [channel, 0])),
    active: true,
    arrivalIntervalMultiplier: 1,
    lastProcessedMinute: minute
  };
}

export function normalizeDigitalLiveQueueState(value, { day = 1, elapsedMinute = 0, seed = 1 } = {}) {
  const safeDay = Math.max(1, Math.floor(finite(day, 1)));
  if (!value || typeof value !== 'object' || Array.isArray(value) || Number(value.day) !== safeDay) {
    return createDigitalLiveQueueState({ day: safeDay, elapsedMinute, seed });
  }
  const fallback = createDigitalLiveQueueState({ day: safeDay, elapsedMinute, seed });
  const next = value.nextArrivalAtMinute && typeof value.nextArrivalAtMinute === 'object'
    ? value.nextArrivalAtMinute : {};
  const arrivals = value.arrivalsByChannel && typeof value.arrivalsByChannel === 'object'
    ? value.arrivalsByChannel : {};
  const overflowed = value.overflowedByChannel && typeof value.overflowedByChannel === 'object'
    ? value.overflowedByChannel : {};
  return {
    version: DIGITAL_LIVE_QUEUE_VERSION,
    day: safeDay,
    seed: positiveSeed(value.seed ?? fallback.seed),
    nextArrivalAtMinute: Object.fromEntries(CHANNEL_KEYS.map(channel => [
      channel,
      Math.max(0, finite(next[channel], fallback.nextArrivalAtMinute[channel]))
    ])),
    arrivals: safeCounter(value.arrivals),
    openingBatchSeeded: value.openingBatchSeeded === true,
    arrivalsByChannel: Object.fromEntries(CHANNEL_KEYS.map(channel => [channel, safeCounter(arrivals[channel])])),
    overflowed: safeCounter(value.overflowed),
    overflowedByChannel: Object.fromEntries(CHANNEL_KEYS.map(channel => [channel, safeCounter(overflowed[channel])])),
    active: value.active !== false,
    arrivalIntervalMultiplier: Math.min(2, Math.max(0.5, finite(value.arrivalIntervalMultiplier, 1))),
    lastProcessedMinute: Math.max(0, finite(value.lastProcessedMinute, elapsedMinute))
  };
}

function waitingCount(queue, channel) {
  return (Array.isArray(queue) ? queue : []).filter(item =>
    item?.status === DIGITAL_STATUS.QUEUED && item.channel === channel
  ).length;
}

function scheduleNext(state, channel, minute, policy) {
  const rule = policy.channels[channel];
  const random = nextRandom(state.seed);
  state.seed = random.seed;
  const jitter = (random.value * 2 - 1) * Math.max(0, finite(rule.jitterMinutes, 0));
  const multiplier = Math.min(2, Math.max(0.5, finite(state.arrivalIntervalMultiplier, 1)));
  const interval = Math.max(3, (finite(rule.intervalMinutes, 20) + jitter) * multiplier);
  // Schedule from the current simulation minute to avoid replaying a backlog
  // of missed arrivals after a suspended browser tab is reopened.
  state.nextArrivalAtMinute[channel] = minute + interval;
}

function stampDigitalContact(contact, now, elapsedMinute) {
  const at = new Date(now).toISOString();
  contact.receivedAt = at;
  contact.simArrivalMinute = Math.max(0, finite(elapsedMinute, 0));
  contact.source = 'automatic_shift_arrival';
  if (Array.isArray(contact.messages) && contact.messages[0]) contact.messages[0].at = at;
  if (Array.isArray(contact.timeline) && contact.timeline[0]) contact.timeline[0].at = at;
  return contact;
}

/**
 * Advance automatic digital arrivals. At most one arrival per channel is
 * processed per tick, preventing a burst when the browser tab was suspended.
 * A full channel records overflow and schedules a fresh future arrival.
 */
export function advanceDigitalLiveQueue({
  queueState,
  queue,
  scenarios,
  day = 1,
  elapsedMinute = 0,
  now = Date.now(),
  sequence = 0,
  slaMinutesOverride = null,
  policy = DIGITAL_LIVE_QUEUE_POLICY
} = {}) {
  const items = Array.isArray(queue) ? queue : [];
  const state = normalizeDigitalLiveQueueState(queueState, { day, elapsedMinute, seed: sequence + day });
  const minute = Math.max(state.lastProcessedMinute, Math.max(0, finite(elapsedMinute, 0)));
  const safeNow = Math.max(0, finite(now, Date.now()));
  const source = Array.isArray(scenarios) ? scenarios.filter(item => item && DIGITAL_CHANNELS[item.channel]) : [];
  const arrivals = [];
  const overflows = [];
  let nextSequence = safeCounter(sequence);

  if (!state.active) {
    state.lastProcessedMinute = minute;
    return { queueState: state, arrivals, overflows, nextSequence };
  }

  for (const channel of CHANNEL_KEYS) {
    if (minute < state.nextArrivalAtMinute[channel]) continue;
    const rule = policy.channels[channel] || DIGITAL_LIVE_QUEUE_POLICY.channels[channel];
    const capacity = Math.max(1, safeCounter(rule.maxWaiting) || DIGITAL_LIVE_QUEUE_POLICY.channels[channel].maxWaiting);
    const channelScenarios = source.filter(item => item.channel === channel);

    if (waitingCount(items, channel) >= capacity) {
      state.overflowed += 1;
      state.overflowedByChannel[channel] += 1;
      overflows.push({ channel, channelLabel: DIGITAL_CHANNELS[channel].label, capacity, atMinute: minute });
      scheduleNext(state, channel, minute, policy);
      continue;
    }

    if (!channelScenarios.length) {
      // Do not permanently stall a channel because its scenario catalogue was
      // temporarily incomplete; retry after a bounded interval.
      state.nextArrivalAtMinute[channel] = minute + 15;
      continue;
    }

    const pick = nextRandom(state.seed);
    state.seed = pick.seed;
    const scenarioIndex = Math.floor(pick.value * channelScenarios.length) % channelScenarios.length;
    const scenario = channelScenarios[scenarioIndex];
    const contacts = createDigitalQueue([scenario], 1, { sequence: nextSequence, now: safeNow, slaMinutesOverride });
    const contact = contacts[0];
    if (contact) {
      nextSequence += 1;
      stampDigitalContact(contact, safeNow, minute);
      items.push(contact);
      arrivals.push(contact);
      state.arrivals += 1;
      state.arrivalsByChannel[channel] += 1;
    }
    scheduleNext(state, channel, minute, policy);
  }

  state.lastProcessedMinute = minute;
  return { queueState: state, arrivals, overflows, nextSequence };
}

export function digitalLiveQueueSnapshot(value, elapsedMinute = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { active: false, arrivals: 0, arrivalsByChannel: Object.fromEntries(CHANNEL_KEYS.map(channel => [channel, 0])), overflowed: 0, overflowedByChannel: Object.fromEntries(CHANNEL_KEYS.map(channel => [channel, 0])), nextArrivalInMinutes: null, nextArrivalInMinutesByChannel: Object.fromEntries(CHANNEL_KEYS.map(channel => [channel, null])), arrivalIntervalMultiplier: 1, lastProcessedMinute: 0 };
  }
  const state = normalizeDigitalLiveQueueState(value, { day: value.day || 1, elapsedMinute, seed: 1 });
  const minute = Math.max(0, finite(elapsedMinute, 0));
  const nextArrivalInMinutesByChannel = Object.fromEntries(CHANNEL_KEYS.map(channel => [
    channel,
    state.active ? Math.max(0, state.nextArrivalAtMinute[channel] - minute) : null
  ]));
  const validNext = Object.values(nextArrivalInMinutesByChannel).filter(Number.isFinite);
  return {
    active: state.active,
    arrivals: state.arrivals,
    arrivalsByChannel: { ...state.arrivalsByChannel },
    overflowed: state.overflowed,
    overflowedByChannel: { ...state.overflowedByChannel },
    nextArrivalInMinutes: validNext.length ? Math.min(...validNext) : null,
    nextArrivalInMinutesByChannel,
    arrivalIntervalMultiplier: state.arrivalIntervalMultiplier,
    lastProcessedMinute: state.lastProcessedMinute
  };
}

export function setDigitalQueueDemandMultiplier(value, multiplier) {
  const state = normalizeDigitalLiveQueueState(value, { day: value?.day || 1 });
  state.arrivalIntervalMultiplier = Math.min(2, Math.max(0.5, finite(multiplier, 1)));
  return state;
}
