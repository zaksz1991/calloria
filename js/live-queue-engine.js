/**
 * CALLORIA v6.59 — live inbound workload simulation.
 *
 * All arrivals and abandonments are synthetic game events. The engine has no
 * network, provider, microphone or real-telephony integration.
 */
import {
  CONTACT_STATUS,
  createInboundQueue,
  countQueuedContacts,
  transitionContact
} from './operations-engine.js';

export const LIVE_QUEUE_VERSION = '6.59.0';
export const DEFAULT_LIVE_QUEUE_POLICY = Object.freeze({
  maxWaiting: 24,
  arrivalIntervals: Object.freeze([
    Object.freeze({ untilMinute: 120, baseMinutes: 8.5 }),
    Object.freeze({ untilMinute: 300, baseMinutes: 10.5 }),
    Object.freeze({ untilMinute: 420, baseMinutes: 8 }),
    Object.freeze({ untilMinute: 540, baseMinutes: 11.5 })
  ]),
  intervalJitterMinutes: 2.5,
  maxArrivalsPerAdvance: 3
});

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

export function customerPatienceMinutes(priority) {
  switch (String(priority || '').toLowerCase()) {
    case 'critical': return 24;
    case 'high': return 21;
    case 'low': return 16;
    default: return 19;
  }
}

export function createLiveQueueState({ day = 1, elapsedMinute = 0, seed = 1 } = {}) {
  const safeDay = Math.max(1, Math.floor(finite(day, 1)));
  const currentMinute = Math.max(0, finite(elapsedMinute));
  const safeSeed = positiveSeed(seed + safeDay * 7919);
  return {
    version: LIVE_QUEUE_VERSION,
    day: safeDay,
    seed: safeSeed,
    nextArrivalAtMinute: currentMinute + 7.5,
    arrivals: 0,
    openingContacts: 0,
    manualContacts: 0,
    abandoned: 0,
    overflowed: 0,
    active: true,
    lastProcessedMinute: currentMinute
  };
}

export function normalizeLiveQueueState(value, { day = 1, elapsedMinute = 0, seed = 1 } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Number(value.day) !== Math.max(1, Math.floor(finite(day, 1)))) {
    return createLiveQueueState({ day, elapsedMinute, seed });
  }
  const fallback = createLiveQueueState({ day, elapsedMinute, seed });
  return {
    version: LIVE_QUEUE_VERSION,
    day: fallback.day,
    seed: positiveSeed(value.seed ?? fallback.seed),
    nextArrivalAtMinute: Math.max(0, finite(value.nextArrivalAtMinute, fallback.nextArrivalAtMinute)),
    arrivals: Math.max(0, Math.floor(finite(value.arrivals))),
    openingContacts: Math.max(0, Math.floor(finite(value.openingContacts))),
    manualContacts: Math.max(0, Math.floor(finite(value.manualContacts))),
    abandoned: Math.max(0, Math.floor(finite(value.abandoned))),
    overflowed: Math.max(0, Math.floor(finite(value.overflowed))),
    active: value.active !== false,
    lastProcessedMinute: Math.max(0, finite(value.lastProcessedMinute, elapsedMinute))
  };
}

/** Stamp a queue batch against the accelerated in-game clock. */
export function stampInboundQueue(contacts, {
  now = Date.now(),
  elapsedMinute = 0,
  source = 'opening_queue',
  spacingMinutes = 0.45
} = {}) {
  if (!Array.isArray(contacts)) return [];
  const currentMinute = Math.max(0, finite(elapsedMinute));
  const spacing = Math.max(0, finite(spacingMinutes));
  contacts.forEach((contact, index) => {
    const ageMinutes = Math.max(0, contacts.length - index - 1) * spacing;
    const queuedAt = new Date(now - ageMinutes * 60_000).toISOString();
    contact.createdAt = queuedAt;
    contact.queuedAt = queuedAt;
    if (Array.isArray(contact.timeline) && contact.timeline.length) {
      contact.timeline[0] = { ...contact.timeline[0], at: queuedAt };
    }
    contact.simArrivalMinute = currentMinute - ageMinutes;
    contact.patienceMinutes = customerPatienceMinutes(contact.priority);
    contact.source = source;
  });
  return contacts;
}

function intervalAtMinute(minute, policy) {
  const row = policy.arrivalIntervals.find(item => minute < item.untilMinute)
    || policy.arrivalIntervals.at(-1);
  return Math.max(5.5, finite(row?.baseMinutes, 10));
}

/** Add an explicit player-triggered batch without exceeding waiting capacity. */
export function addManualDemandSurge({
  queue,
  scenarios,
  count = 6,
  day = 1,
  elapsedMinute = 0,
  now = Date.now(),
  sequence = 0,
  queueState,
  policy = DEFAULT_LIVE_QUEUE_POLICY
} = {}) {
  const queueItems = Array.isArray(queue) ? queue : [];
  const requested = Math.max(0, Math.floor(finite(count)));
  const state = normalizeLiveQueueState(queueState, { day, elapsedMinute, seed: sequence + day });
  const capacity = Math.max(0, Math.floor(finite(policy.maxWaiting, DEFAULT_LIVE_QUEUE_POLICY.maxWaiting)));
  const available = state.active ? Math.max(0, capacity - countQueuedContacts(queueItems)) : 0;
  const admitted = Math.min(requested, available);
  const overflowed = requested - admitted;
  const contacts = admitted > 0
    ? createInboundQueue(Array.isArray(scenarios) ? scenarios : [], admitted, { sequence, now })
    : [];
  stampInboundQueue(contacts, {
    now,
    elapsedMinute,
    source: 'manual_demand_surge'
  });
  queueItems.push(...contacts);
  state.manualContacts += contacts.length;
  state.overflowed += overflowed;
  return {
    queueState: state,
    contacts,
    requested,
    admitted: contacts.length,
    overflowed,
    nextSequence: Math.max(0, Math.floor(finite(sequence))) + contacts.length
  };
}

/**
 * Advance the simulated queue to the supplied in-game minute.
 * Mutates queueState and queue, returning the precise events for the caller to
 * record in the shift audit trail. The clock passed in `now` must use the same
 * accelerated simulation epoch as the queuedAt timestamps.
 */
export function advanceLiveQueue({
  queueState,
  queue,
  scenarios,
  day = 1,
  elapsedMinute = 0,
  now = Date.now(),
  sequence = 0,
  policy = DEFAULT_LIVE_QUEUE_POLICY
} = {}) {
  const queueItems = Array.isArray(queue) ? queue : [];
  const scenarioList = Array.isArray(scenarios) ? scenarios.filter(Boolean) : [];
  const minute = Math.max(0, finite(elapsedMinute));
  const simulatedNow = finite(now, Date.now());
  const state = normalizeLiveQueueState(queueState, { day, elapsedMinute: minute, seed: sequence + day });
  const arrivals = [];
  const abandonments = [];
  let nextSequence = Math.max(0, Math.floor(finite(sequence)));

  if (minute >= 540 || !scenarioList.length) state.active = false;
  if (!state.active) {
    state.lastProcessedMinute = Math.max(state.lastProcessedMinute, minute);
    return { queueState: state, arrivals, abandonments, nextSequence };
  }

  let guard = 0;
  while (minute >= state.nextArrivalAtMinute && guard < Math.max(1, Math.floor(policy.maxArrivalsPerAdvance || 3))) {
    const waiting = countQueuedContacts(queueItems);
    if (waiting < Math.max(1, Math.floor(policy.maxWaiting || 24))) {
      const arrivalMinute = state.nextArrivalAtMinute;
      const arrivalAtMs = simulatedNow - Math.max(0, minute - arrivalMinute) * 60_000;
      const [contact] = createInboundQueue(scenarioList, 1, {
        sequence: nextSequence,
        now: arrivalAtMs
      });
      if (contact) {
        stampInboundQueue([contact], {
          now: arrivalAtMs,
          elapsedMinute: arrivalMinute,
          source: 'live_arrival',
          spacingMinutes: 0
        });
        contact.arrivalNumber = state.arrivals + 1;
        queueItems.push(contact);
        arrivals.push(contact);
        state.arrivals += 1;
        nextSequence += 1;
      }
    } else {
      state.overflowed += 1;
    }

    const random = nextRandom(state.seed);
    state.seed = random.seed;
    const jitter = (random.value - 0.5) * Math.max(0, finite(policy.intervalJitterMinutes, 2.5));
    state.nextArrivalAtMinute += Math.max(5.5, intervalAtMinute(state.nextArrivalAtMinute, policy) + jitter);
    guard += 1;
  }

  for (const contact of queueItems) {
    if (contact?.status !== CONTACT_STATUS.QUEUED) continue;
    const queuedAt = Date.parse(contact.queuedAt || '');
    if (!Number.isFinite(queuedAt)) continue;
    const waitMinutes = Math.max(0, (simulatedNow - queuedAt) / 60_000);
    const patience = Math.max(1, finite(contact.patienceMinutes, customerPatienceMinutes(contact.priority)));
    if (waitMinutes < patience) continue;
    transitionContact(contact, CONTACT_STATUS.ABANDONED, 'Customer abandoned after exceeding simulated queue patience.', simulatedNow, {
      waitMinutes: Math.round(waitMinutes * 10) / 10,
      patienceMinutes: patience,
      source: 'live_queue_simulation'
    });
    abandonments.push(contact);
    state.abandoned += 1;
  }

  state.lastProcessedMinute = Math.max(state.lastProcessedMinute, minute);
  return { queueState: state, arrivals, abandonments, nextSequence };
}

export function liveQueueSnapshot(queueState, elapsedMinute = 0) {
  const state = queueState && typeof queueState === 'object' ? queueState : createLiveQueueState();
  const remaining = Math.max(0, finite(state.nextArrivalAtMinute) - Math.max(0, finite(elapsedMinute)));
  return {
    arrivals: Math.max(0, Math.floor(finite(state.arrivals))),
    openingContacts: Math.max(0, Math.floor(finite(state.openingContacts))),
    manualContacts: Math.max(0, Math.floor(finite(state.manualContacts))),
    totalArrivals: Math.max(0, Math.floor(finite(state.arrivals))) + Math.max(0, Math.floor(finite(state.openingContacts))) + Math.max(0, Math.floor(finite(state.manualContacts))),
    abandoned: Math.max(0, Math.floor(finite(state.abandoned))),
    overflowed: Math.max(0, Math.floor(finite(state.overflowed))),
    nextArrivalInMinutes: state.active ? remaining : null,
    active: state.active !== false
  };
}
