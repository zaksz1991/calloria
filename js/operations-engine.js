/**
 * CALLORIA Operations Engine — deterministic client-side simulation domain.
 * This module owns contact lifecycle, queue prioritisation, interaction events,
 * callback scheduling and outbound suppression rules. It does not place calls
 * or connect to real customer systems.
 */

export const CONTACT_STATUS = Object.freeze({
  QUEUED: 'queued',
  OFFERED: 'offered',
  CONNECTED: 'connected',
  ON_HOLD: 'on_hold',
  TRANSFERRED: 'transferred',
  WRAP_UP: 'wrap_up',
  CALLBACK: 'callback',
  COMPLETED: 'completed',
  ESCALATED: 'escalated',
  ABANDONED: 'abandoned'
});

const PRIORITY_WEIGHT = Object.freeze({ critical: 3, high: 2, normal: 1, low: 0 });

const TRANSITIONS = Object.freeze({
  queued: ['offered', 'callback', 'abandoned'],
  offered: ['connected', 'queued', 'abandoned'],
  connected: ['on_hold', 'transferred', 'wrap_up', 'queued', 'abandoned'],
  on_hold: ['connected', 'transferred', 'wrap_up', 'queued', 'abandoned'],
  transferred: ['wrap_up', 'completed', 'escalated'],
  wrap_up: ['completed', 'escalated', 'callback'],
  callback: ['queued', 'abandoned'],
  completed: [],
  escalated: [],
  abandoned: []
});

function makeId(prefix, sequence, now) {
  return `${prefix}-${Number(now).toString(36).toUpperCase()}-${Number(sequence).toString(36).toUpperCase().padStart(3, '0')}`;
}

export function priorityForScenario(scenario) {
  const text = `${scenario?.id || ''} ${scenario?.category || ''} ${scenario?.issue || ''}`.toLowerCase();
  if (/fraud|security|suspicious|compromis|takeover/.test(text)) return 'critical';
  if (/complaint|dispute|declined|failed|chargeback/.test(text)) return 'high';
  if (/delivery|appointment|feedback/.test(text)) return 'low';
  return 'normal';
}

export function routeGroupForScenario(scenario) {
  const text = `${scenario?.id || ''} ${scenario?.category || ''} ${scenario?.issue || ''}`.toLowerCase();
  if (/fraud|security|suspicious|compromis|takeover/.test(text)) return 'Fraud & Security';
  if (/card|atm|pos|switch/.test(text)) return 'Cards & Payments';
  if (/digital|mobile|app|ussd|online/.test(text)) return 'Digital Support';
  if (/complaint|dispute|chargeback/.test(text)) return 'Complaints';
  if (/loan|credit|finance/.test(text)) return 'Lending Support';
  return 'Customer Services';
}

export function createInboundQueue(scenarios, count = 6, options = {}) {
  const list = Array.isArray(scenarios) ? scenarios.filter(Boolean) : [];
  if (!list.length || !Number.isFinite(count) || count <= 0) return [];
  const now = Number(options.now ?? Date.now());
  const sequence = Number(options.sequence ?? 0);
  return Array.from({ length: Math.min(50, Math.floor(count)) }, (_, index) => {
    const scenario = list[(sequence + index) % list.length];
    const createdAt = now - ((count - index) * 11000);
    return {
      id: makeId('INB', sequence + index + 1, now),
      scenarioId: scenario.id,
      customer: scenario.customer,
      initials: scenario.initials,
      category: scenario.category,
      issue: scenario.issue,
      channel: 'Voice',
      routeGroup: routeGroupForScenario(scenario),
      priority: priorityForScenario(scenario),
      status: CONTACT_STATUS.QUEUED,
      queuedAt: new Date(createdAt).toISOString(),
      createdAt: new Date(createdAt).toISOString(),
      acceptedAt: null,
      completedAt: null,
      timeline: [{ at: new Date(createdAt).toISOString(), event: 'Contact entered inbound queue', status: CONTACT_STATUS.QUEUED }]
    };
  });
}

export function sortQueuedContacts(queue, now = Date.now()) {
  return (Array.isArray(queue) ? queue : [])
    .filter(contact => contact?.status === CONTACT_STATUS.QUEUED)
    .slice()
    .sort((a, b) => {
      const priority = (PRIORITY_WEIGHT[b.priority] ?? 1) - (PRIORITY_WEIGHT[a.priority] ?? 1);
      if (priority) return priority;
      return Date.parse(a.queuedAt || 0) - Date.parse(b.queuedAt || 0) || String(a.id).localeCompare(String(b.id));
    })
    .map(contact => ({ ...contact, waitSeconds: Math.max(0, Math.floor((now - Date.parse(contact.queuedAt || now)) / 1000)) }));
}

export function nextQueuedContact(queue, now = Date.now()) {
  return sortQueuedContacts(queue, now)[0] || null;
}

export function transitionContact(contact, nextStatus, event, now = Date.now(), details = {}) {
  if (!contact || !Object.hasOwn(TRANSITIONS, contact.status)) {
    throw new TypeError('A valid contact with a known current status is required.');
  }
  if (!TRANSITIONS[contact.status].includes(nextStatus)) {
    throw new Error(`Invalid contact transition: ${contact.status} → ${nextStatus}`);
  }
  const at = new Date(now).toISOString();
  contact.status = nextStatus;
  if (nextStatus === CONTACT_STATUS.CONNECTED && !contact.acceptedAt) contact.acceptedAt = at;
  if (['completed', 'escalated', 'abandoned'].includes(nextStatus)) contact.completedAt = at;
  contact.timeline = Array.isArray(contact.timeline) ? contact.timeline : [];
  contact.timeline.push({ at, event: String(event || nextStatus), status: nextStatus, ...details });
  return contact;
}

export function addInteractionEvent(events, event, now = Date.now()) {
  const list = Array.isArray(events) ? events : [];
  const sequence = list.length + 1;
  const item = {
    id: makeId('EVT', sequence, now),
    at: new Date(now).toISOString(),
    type: String(event?.type || 'activity'),
    reference: String(event?.reference || ''),
    message: String(event?.message || ''),
    status: String(event?.status || 'recorded'),
    details: event?.details && typeof event.details === 'object' ? event.details : {}
  };
  list.push(item);
  if (list.length > 300) list.splice(0, list.length - 300);
  return item;
}

export function countQueuedContacts(queue) {
  return (Array.isArray(queue) ? queue : []).filter(contact => contact?.status === CONTACT_STATUS.QUEUED).length;
}

export function queueMetrics(queue, now = Date.now(), serviceLevelSeconds = 60) {
  const queued = sortQueuedContacts(queue, now);
  const waits = queued.map(contact => contact.waitSeconds);
  return {
    waiting: queued.length,
    longestWaitSeconds: waits.length ? Math.max(...waits) : 0,
    averageWaitSeconds: waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : 0,
    withinServiceLevel: queued.filter(contact => contact.waitSeconds <= serviceLevelSeconds).length,
    serviceLevelSeconds
  };
}

export function isContactSuppressed(contactKey, suppressions) {
  const key = String(contactKey || '').trim().toLowerCase();
  return !!key && (Array.isArray(suppressions) ? suppressions : []).some(item => String(item?.contactKey || '').trim().toLowerCase() === key);
}

export function addSuppression(suppressions, contactKey, reason = 'Customer requested no further campaign contact', now = Date.now()) {
  const list = Array.isArray(suppressions) ? suppressions : [];
  const key = String(contactKey || '').trim();
  if (!key) throw new TypeError('A contact key is required to record a suppression.');
  const existing = list.find(item => String(item.contactKey).toLowerCase() === key.toLowerCase());
  if (existing) return existing;
  const item = { id: makeId('SUP', list.length + 1, now), contactKey: key, reason: String(reason), createdAt: new Date(now).toISOString(), source: 'simulation' };
  list.push(item);
  return item;
}

export function completeActiveCallback(callbacks, { callbackId = null, contactId = null } = {}, now = Date.now()) {
  const list = Array.isArray(callbacks) ? callbacks : [];
  const callback = list.find(item => item?.status === 'in_progress' && (
    callbackId ? item.id === callbackId : contactId && item.contactId === contactId
  ));
  if (!callback) return null;
  callback.status = 'completed';
  callback.completedAt = new Date(now).toISOString();
  return callback;
}

export function scheduleCallback(callbacks, contact, dueAt, now = Date.now()) {
  if (!contact?.id) throw new TypeError('A contact is required to schedule a callback.');
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due) || due <= now) throw new RangeError('Callback time must be a valid future date and time.');
  const list = Array.isArray(callbacks) ? callbacks : [];
  const existing = list.find(item => item.contactId === contact.id && item.status === 'scheduled');
  if (existing) throw new Error('A scheduled callback already exists for this contact.');
  const item = {
    id: makeId('CBK', list.length + 1, now),
    contactId: contact.id,
    customer: contact.customer,
    scenarioId: contact.scenarioId,
    issue: contact.issue,
    dueAt: new Date(due).toISOString(),
    status: 'scheduled',
    createdAt: new Date(now).toISOString()
  };
  list.push(item);
  return item;
}
