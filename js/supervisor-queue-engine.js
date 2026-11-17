/**
 * CALLORIA v6.60 — supervisor queue control and triage rules.
 * All records operate on the synthetic local simulator queues. No real customer
 * channel, telephony provider or external workforce is controlled by this file.
 */

import { DIGITAL_CHANNELS, DIGITAL_STATUS } from './multichannel-engine.js';
import { assessDigitalSla, digitalSlaDisplay } from './digital-sla-engine.js';
import { digitalCustomerBehaviourMetrics, digitalCustomerBehaviourRiskItems } from './digital-customer-behaviour-engine.js';

export const SUPERVISOR_QUEUE_VERSION = '6.60.0';

export const SUPERVISOR_INTAKE_MODES = Object.freeze({
  normal: Object.freeze({ label: 'Standard', multiplier: 1, description: 'Normal simulated contact arrival rate.' }),
  busy: Object.freeze({ label: 'Busy period', multiplier: 0.72, description: 'Higher simulated arrival pressure.' }),
  recovery: Object.freeze({ label: 'Recovery', multiplier: 1.42, description: 'Slower arrivals while the team clears waiting work.' })
});

export const SUPERVISOR_PRIORITIES = Object.freeze(['critical', 'high', 'normal', 'low']);

export const SUPERVISOR_ROUTE_GROUPS = Object.freeze([
  'Customer Services',
  'Fraud & Security',
  'Cards & Payments',
  'Fraud & Payments',
  'Digital Support',
  'Complaints',
  'Complaints Management',
  'Lending Support',
  'Transfers Support',
  'Technical Support',
  'Specialist Support',
  'Customer Experience'
]);

const MAX_HISTORY = 40;

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value, max = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isPriority(value) {
  return SUPERVISOR_PRIORITIES.includes(String(value || '').toLowerCase());
}

export function createSupervisorQueueControl() {
  return {
    version: SUPERVISOR_QUEUE_VERSION,
    paused: false,
    mode: 'normal',
    history: [],
    updatedAt: null,
    updatedBy: null
  };
}

export function normalizeSupervisorQueueControl(value) {
  const fallback = createSupervisorQueueControl();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const mode = Object.hasOwn(SUPERVISOR_INTAKE_MODES, value.mode) ? value.mode : 'normal';
  const history = Array.isArray(value.history) ? value.history.slice(-MAX_HISTORY).filter(item => item && typeof item === 'object').map(item => ({
    id: cleanText(item.id, 80),
    action: cleanText(item.action, 40),
    from: cleanText(item.from, 80),
    to: cleanText(item.to, 80),
    reason: cleanText(item.reason, 160),
    actor: cleanText(item.actor, 80) || 'Supervisor',
    at: cleanText(item.at, 40)
  })) : [];
  return {
    version: SUPERVISOR_QUEUE_VERSION,
    paused: value.paused === true,
    mode,
    history,
    updatedAt: cleanText(value.updatedAt, 40) || null,
    updatedBy: cleanText(value.updatedBy, 80) || null
  };
}

/** Update intake state without confusing a temporary pause with a closed shift. */
export function updateSupervisorQueueControl(value, action, {
  actor = 'Supervisor',
  reason = '',
  now = Date.now()
} = {}) {
  const control = normalizeSupervisorQueueControl(value);
  const safeActor = cleanText(actor, 80) || 'Supervisor';
  const safeReason = cleanText(reason, 160);
  if (safeReason.length < 4) throw new TypeError('Enter a supervisor reason of at least four characters.');
  let nextValue;
  let actionName;

  if (action === 'pause' || action === 'resume') {
    nextValue = action === 'pause';
    actionName = action === 'pause' ? 'intake_paused' : 'intake_resumed';
    if (control.paused === nextValue) return { control, changed: false, event: null };
    const previous = control.paused ? 'paused' : 'open';
    control.paused = nextValue;
    return recordControlChange(control, { action: actionName, from: previous, to: nextValue ? 'paused' : 'open', reason: safeReason, actor: safeActor, now });
  }

  if (typeof action === 'string' && action.startsWith('mode:')) {
    const mode = action.slice(5);
    if (!Object.hasOwn(SUPERVISOR_INTAKE_MODES, mode)) throw new RangeError('Choose a valid simulated intake mode.');
    if (control.mode === mode) return { control, changed: false, event: null };
    const previous = control.mode;
    control.mode = mode;
    return recordControlChange(control, { action: 'intake_mode_changed', from: previous, to: mode, reason: safeReason, actor: safeActor, now });
  }

  throw new RangeError('Unsupported supervisor queue-control action.');
}

function recordControlChange(control, { action, from, to, reason, actor, now }) {
  const timestamp = new Date(safeNumber(now, Date.now())).toISOString();
  const event = {
    id: `SUPQ-${Date.parse(timestamp).toString(36).toUpperCase()}-${(control.history.length + 1).toString(36).toUpperCase()}`,
    action,
    from,
    to,
    reason,
    actor,
    at: timestamp
  };
  control.history.push(event);
  control.history = control.history.slice(-MAX_HISTORY);
  control.updatedAt = timestamp;
  control.updatedBy = actor;
  return { control, changed: true, event };
}

function validateTriagePatch(patch = {}) {
  const hasPriority = patch.priority !== undefined && patch.priority !== null && patch.priority !== '';
  const hasRoute = patch.routeGroup !== undefined && patch.routeGroup !== null && patch.routeGroup !== '';
  if (!hasPriority && !hasRoute) throw new TypeError('Change a priority or route before saving triage.');
  if (hasPriority && !isPriority(patch.priority)) throw new RangeError('Choose a valid contact priority.');
  const routeGroup = hasRoute ? cleanText(patch.routeGroup, 80) : '';
  if (hasRoute && !SUPERVISOR_ROUTE_GROUPS.includes(routeGroup)) throw new RangeError('Choose a supported route group.');
  const reason = cleanText(patch.reason, 160);
  if (reason.length < 4) throw new TypeError('Enter a short supervisor reason of at least four characters.');
  return { priority: hasPriority ? String(patch.priority).toLowerCase() : null, routeGroup: hasRoute ? routeGroup : null, reason };
}

function recordTriage(contact, patch, { actor = 'Supervisor', now = Date.now(), channel = 'Voice' } = {}) {
  const changes = {};
  if (patch.priority && patch.priority !== contact.priority) {
    changes.priority = { from: contact.priority || 'normal', to: patch.priority };
    contact.priority = patch.priority;
  }
  if (patch.routeGroup && patch.routeGroup !== contact.routeGroup) {
    changes.routeGroup = { from: contact.routeGroup || 'Customer Services', to: patch.routeGroup };
    contact.routeGroup = patch.routeGroup;
  }
  if (!Object.keys(changes).length) return { changed: false, contact, event: null };
  const timestamp = new Date(safeNumber(now, Date.now())).toISOString();
  const event = {
    at: timestamp,
    event: `Supervisor triage updated ${channel.toLowerCase()} contact`,
    status: 'supervisor_triaged',
    actor: cleanText(actor, 80) || 'Supervisor',
    reason: patch.reason,
    changes
  };
  if (!Array.isArray(contact.timeline)) contact.timeline = [];
  contact.timeline.push(event);
  contact.supervisorTriage = { actor: event.actor, reason: patch.reason, at: timestamp, changes };
  return { changed: true, contact, event };
}

export function triageInboundContact(queue, contactId, patch, options = {}) {
  const contact = (Array.isArray(queue) ? queue : []).find(item => item?.id === contactId);
  if (!contact) throw new Error('Inbound queue contact was not found.');
  if (contact.status !== 'queued') throw new Error('Only waiting inbound contacts can be triaged.');
  return recordTriage(contact, validateTriagePatch(patch), { ...options, channel: 'Voice' });
}

export function triageDigitalContact(queue, contactId, patch, options = {}) {
  const contact = (Array.isArray(queue) ? queue : []).find(item => item?.id === contactId);
  if (!contact) throw new Error('Digital queue contact was not found.');
  if (contact.status !== 'queued') throw new Error('Only waiting digital contacts can be triaged.');
  return recordTriage(contact, validateTriagePatch(patch), { ...options, channel: contact.channelLabel || contact.channel || 'Digital' });
}

/** Build a single supervisor snapshot across the simulated voice and digital queues. */
export function supervisorQueueBoard({
  inboundQueue = [],
  digitalQueue = [],
  supervisorRequests = [],
  cases = [],
  currentCall = null,
  activeOutbound = null,
  digitalActiveId = null,
  now = Date.now(),
  voiceNow = now,
  digitalNow = now,
  voiceSlaSeconds = 60
} = {}) {
  const voice = (Array.isArray(inboundQueue) ? inboundQueue : []).filter(item => item?.status === 'queued').map(item => {
    const queuedAt = Date.parse(item.queuedAt || item.createdAt || '');
    const waitSeconds = Number.isFinite(queuedAt) ? Math.max(0, Math.floor((voiceNow - queuedAt) / 1000)) : 0;
    return { ...item, waitSeconds, slaAtRisk: waitSeconds >= Math.max(1, voiceSlaSeconds) };
  }).sort((a, b) => (SUPERVISOR_PRIORITIES.indexOf(a.priority) - SUPERVISOR_PRIORITIES.indexOf(b.priority)) || (b.waitSeconds - a.waitSeconds));

  const digital = (Array.isArray(digitalQueue) ? digitalQueue : []).filter(item => item?.status === 'queued').map(item => {
    const receivedAt = Date.parse(item.receivedAt || '');
    const waitSeconds = Number.isFinite(receivedAt) ? Math.max(0, Math.floor((digitalNow - receivedAt) / 1000)) : 0;
    const sla = assessDigitalSla(item, digitalNow);
    const slaSeconds = Math.max(60, safeNumber(sla.targetMinutes, 1) * 60);
    return {
      ...item,
      waitSeconds,
      slaSeconds,
      slaStatus: sla.status,
      slaDisplay: digitalSlaDisplay(sla),
      slaRemainingSeconds: Math.ceil(Math.max(0, sla.remainingMs || 0) / 1000),
      slaOverdueSeconds: Math.ceil(Math.max(0, sla.overdueMs || 0) / 1000),
      slaAtRisk: sla.status === 'at_risk' || sla.status === 'breached',
      slaBreached: sla.status === 'breached'
    };
  }).sort((a, b) => (SUPERVISOR_PRIORITIES.indexOf(a.priority) - SUPERVISOR_PRIORITIES.indexOf(b.priority)) || (b.waitSeconds - a.waitSeconds));

  const priorityCounts = Object.fromEntries(SUPERVISOR_PRIORITIES.map(priority => [priority, voice.filter(item => item.priority === priority).length + digital.filter(item => item.priority === priority).length]));
  const openRequests = (Array.isArray(supervisorRequests) ? supervisorRequests : []).filter(item => item?.status === 'open');
  const escalatedCases = (Array.isArray(cases) ? cases : []).filter(item => /escalated|review|required/i.test(String(item?.status || '')));
  const activeDigitalItems = (Array.isArray(digitalQueue) ? digitalQueue : []).filter(item => item?.status === DIGITAL_STATUS.ACTIVE);
  const awaitingCustomerItems = (Array.isArray(digitalQueue) ? digitalQueue : []).filter(item => item?.status === DIGITAL_STATUS.AWAITING_CUSTOMER);
  const openDigitalSla = (Array.isArray(digitalQueue) ? digitalQueue : [])
    .filter(item => [DIGITAL_STATUS.QUEUED, DIGITAL_STATUS.ACTIVE].includes(item?.status))
    .map(item => assessDigitalSla(item, digitalNow));
  const digitalSlaAtRisk = openDigitalSla.filter(item => item.status === 'at_risk').length;
  const digitalSlaBreached = openDigitalSla.filter(item => item.status === 'breached').length;
  const riskCount = voice.filter(item => item.slaAtRisk).length + openDigitalSla.filter(item => ['at_risk', 'breached'].includes(item.status)).length;
  const oldestVoiceWait = voice.length ? Math.max(...voice.map(item => item.waitSeconds)) : 0;
  const oldestDigitalWait = digital.length ? Math.max(...digital.map(item => item.waitSeconds)) : 0;
  const legacySelectedDigital = digitalActiveId && !(Array.isArray(digitalQueue) ? digitalQueue : []).some(item => item?.id === digitalActiveId && [DIGITAL_STATUS.ACTIVE, DIGITAL_STATUS.AWAITING_CUSTOMER].includes(item.status)) ? 1 : 0;
  const activeDigital = activeDigitalItems.length + legacySelectedDigital;
  const activeDigitalByChannel = Object.fromEntries(Object.keys(DIGITAL_CHANNELS).map(channel => [
    channel, activeDigitalItems.filter(item => item.channel === channel).length
  ]));
  const customerBehaviour = digitalCustomerBehaviourMetrics(digitalQueue);
  const customerRiskItems = digitalCustomerBehaviourRiskItems(digitalQueue).map(({ contact, behaviour }) => ({
    id: contact.id,
    customer: contact.customer || 'Customer',
    subject: contact.subject || 'Digital contact',
    channel: contact.channelLabel || DIGITAL_CHANNELS[contact.channel]?.label || contact.channel || 'Digital',
    mood: behaviour.mood,
    sentiment: behaviour.sentiment,
    reason: behaviour.supervisorReason
  }));

  return {
    voiceWaiting: voice.length,
    digitalWaiting: digital.length,
    totalWaiting: voice.length + digital.length,
    slaAtRisk: riskCount,
    digitalSlaAtRisk,
    digitalSlaBreached,
    openRequests: openRequests.length,
    escalatedCases: escalatedCases.length,
    activeDigital,
    awaitingCustomer: awaitingCustomerItems.length,
    activeDigitalByChannel,
    customerEscalationRecommended: customerBehaviour.supervisorRecommended,
    averageCustomerSentiment: customerBehaviour.averageOpenSentiment,
    customerFrustratedOpen: customerBehaviour.frustratedOpen,
    customerRiskItems,
    activeWork: Number(Boolean(currentCall)) + Number(Boolean(activeOutbound)) + activeDigital,
    oldestVoiceWaitSeconds: oldestVoiceWait,
    oldestDigitalWaitSeconds: oldestDigitalWait,
    priorityCounts,
    voice,
    digital,
    openRequestItems: openRequests,
    escalatedCaseItems: escalatedCases
  };
}
