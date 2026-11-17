/**
 * CALLORIA v6.63 — digital first-response SLA tracking.
 * Timers use the simulator's supplied clock. These are synthetic gameplay
 * targets, not contractual service levels or a connection to live providers.
 */
import { DIGITAL_CHANNELS, DIGITAL_STATUS } from './multichannel-engine.js';

export const DIGITAL_SLA_VERSION = '6.63.0';
export const DEFAULT_DIGITAL_SLA_POLICY = Object.freeze({
  riskThreshold: 0.75,
  channelTargetsMinutes: Object.freeze({ email: 240, live_chat: 2, social: 20 }),
  minimumTargetMinutes: 1,
  maximumTargetMinutes: 10080
});

const TRACKED_STATUSES = new Set([DIGITAL_STATUS.QUEUED, DIGITAL_STATUS.ACTIVE]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function targetMinutes(contact, policy = DEFAULT_DIGITAL_SLA_POLICY) {
  const source = Number(contact?.slaMinutes);
  const channelTarget = finite(policy?.channelTargetsMinutes?.[contact?.channel],
    DEFAULT_DIGITAL_SLA_POLICY.channelTargetsMinutes[contact?.channel] || 20);
  const raw = Number.isFinite(source) && source > 0 ? source : channelTarget;
  return Math.min(DEFAULT_DIGITAL_SLA_POLICY.maximumTargetMinutes,
    Math.max(DEFAULT_DIGITAL_SLA_POLICY.minimumTargetMinutes, raw));
}

function cleanRiskThreshold(value) {
  return Math.min(0.95, Math.max(0.5, finite(value, DEFAULT_DIGITAL_SLA_POLICY.riskThreshold)));
}

/**
 * Pure status assessment for one digital contact. The first-response timer
 * stops at firstResponseAt; later customer follow-ups do not restart it.
 */
export function assessDigitalSla(contact, now = Date.now(), policy = DEFAULT_DIGITAL_SLA_POLICY) {
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return { status: 'unavailable', label: 'Unavailable', targetMinutes: 0, remainingMs: null, overdueMs: 0, progressPercent: 0, responded: false };
  }
  const receivedAtMs = timestamp(contact.receivedAt);
  if (receivedAtMs === null) {
    return { status: 'unavailable', label: 'No receipt time', targetMinutes: targetMinutes(contact, policy), remainingMs: null, overdueMs: 0, progressPercent: 0, responded: false };
  }
  const target = targetMinutes(contact, policy);
  const targetMs = target * 60_000;
  const dueAtMs = timestamp(contact.slaDueAt) ?? (receivedAtMs + targetMs);
  const safeNow = Math.max(0, finite(now, Date.now()));
  const firstResponseMs = timestamp(contact.firstResponseAt);
  const responded = firstResponseMs !== null;
  const threshold = cleanRiskThreshold(policy?.riskThreshold);

  if (responded) {
    const responseMs = Math.max(0, firstResponseMs - receivedAtMs);
    const met = responseMs <= (dueAtMs - receivedAtMs);
    return {
      status: met ? 'met' : 'breached',
      label: met ? 'Met target' : 'First response late',
      targetMinutes: target,
      dueAt: new Date(dueAtMs).toISOString(),
      remainingMs: 0,
      overdueMs: met ? 0 : Math.max(0, responseMs - (dueAtMs - receivedAtMs)),
      elapsedMs: responseMs,
      progressPercent: Math.min(100, Math.round(responseMs / targetMs * 100)),
      responseMinutes: Math.round(responseMs / 60_000 * 10) / 10,
      responded: true
    };
  }

  const elapsedMs = Math.max(0, safeNow - receivedAtMs);
  const remainingMs = dueAtMs - safeNow;
  const status = remainingMs <= 0 ? 'breached' : elapsedMs >= targetMs * threshold ? 'at_risk' : 'on_track';
  return {
    status,
    label: status === 'breached' ? 'SLA breached' : status === 'at_risk' ? 'Due soon' : 'On track',
    targetMinutes: target,
    dueAt: new Date(dueAtMs).toISOString(),
    remainingMs: Math.max(0, remainingMs),
    overdueMs: Math.max(0, -remainingMs),
    elapsedMs,
    progressPercent: Math.min(100, Math.round(elapsedMs / targetMs * 100)),
    responded: false
  };
}

/** Format an assessment for compact agent/supervisor worklists. */
export function digitalSlaDisplay(assessment) {
  const item = assessment || {};
  if (item.status === 'met') return 'MET';
  if (item.status === 'breached') return item.responded ? `LATE ${Math.ceil(item.overdueMs / 60_000)}m` : `OVERDUE ${Math.ceil(item.overdueMs / 60_000)}m`;
  if (item.status === 'at_risk') return `DUE ${Math.max(1, Math.ceil((item.remainingMs || 0) / 60_000))}m`;
  if (item.status === 'on_track') return `${Math.max(1, Math.ceil((item.remainingMs || 0) / 60_000))}m LEFT`;
  return 'SLA N/A';
}

/**
 * Advance the queue SLA monitor once per simulator tick. Risk and breach events
 * are recorded once on the contact timeline; the returned transitions let the
 * application add its normal operations events without duplicate log entries.
 */
export function advanceDigitalSlaMonitor(queue, now = Date.now(), policy = DEFAULT_DIGITAL_SLA_POLICY) {
  const items = Array.isArray(queue) ? queue : [];
  const newlyAtRisk = [];
  const newlyBreached = [];
  const newlyMet = [];
  const evaluated = [];

  for (const contact of items) {
    if (!contact || typeof contact !== 'object' || Array.isArray(contact)) continue;
    if (!contact.receivedAt || !DIGITAL_CHANNELS[contact.channel]) continue;
    const shouldTrack = TRACKED_STATUSES.has(contact.status) || (contact.status === DIGITAL_STATUS.AWAITING_CUSTOMER && Boolean(contact.firstResponseAt));
    if (!shouldTrack) continue;
    const previous = String(contact.slaTrackingStatus || '');
    const assessment = assessDigitalSla(contact, now, policy);
    evaluated.push({ contact, assessment });
    if (assessment.status === 'unavailable') continue;

    if (!contact.slaDueAt && assessment.dueAt) contact.slaDueAt = assessment.dueAt;
    contact.slaTrackingVersion = DIGITAL_SLA_VERSION;
    contact.slaTrackingStatus = assessment.status;
    contact.slaTargetMinutes = assessment.targetMinutes;
    contact.slaLastEvaluatedAt = new Date(Math.max(0, finite(now, Date.now()))).toISOString();

    if (TRACKED_STATUSES.has(contact.status) && !assessment.responded && assessment.status === 'at_risk' && previous !== 'at_risk' && previous !== 'breached') {
      contact.slaAtRiskAt ||= contact.slaLastEvaluatedAt;
      const event = { at: contact.slaLastEvaluatedAt, event: 'Digital first-response SLA entered risk window', status: 'sla_at_risk', targetMinutes: assessment.targetMinutes };
      if (!Array.isArray(contact.timeline)) contact.timeline = [];
      contact.timeline.push(event);
      newlyAtRisk.push({ contact, assessment, event });
    }

    if (assessment.status === 'breached' && !contact.slaBreachRecordedAt) {
      contact.slaBreachRecordedAt = contact.slaLastEvaluatedAt;
      const event = {
        at: contact.slaBreachRecordedAt,
        event: assessment.responded ? 'Digital first-response SLA breached by late agent response' : 'Digital first-response SLA breached while waiting',
        status: 'sla_breached',
        targetMinutes: assessment.targetMinutes,
        overdueMs: assessment.overdueMs
      };
      if (!Array.isArray(contact.timeline)) contact.timeline = [];
      contact.timeline.push(event);
      newlyBreached.push({ contact, assessment, event });
    }

    if (assessment.status === 'met' && contact.firstResponseAt && !contact.slaMetAt) {
      contact.slaMetAt = contact.firstResponseAt;
      const event = { at: contact.firstResponseAt, event: 'Digital first-response SLA met before the target', status: 'sla_met', targetMinutes: assessment.targetMinutes };
      if (!Array.isArray(contact.timeline)) contact.timeline = [];
      contact.timeline.push(event);
      newlyMet.push({ contact, assessment, event });
    }
  }

  return { queue: items, newlyAtRisk, newlyBreached, newlyMet, evaluated };
}

/** Aggregate current first-response status across waiting and active digital work. */
export function digitalSlaMetrics(queue, now = Date.now(), policy = DEFAULT_DIGITAL_SLA_POLICY) {
  const items = (Array.isArray(queue) ? queue : []).filter(item => item && typeof item === 'object');
  const open = items.filter(item => TRACKED_STATUSES.has(item.status) && !item.firstResponseAt);
  const assessments = open.map(contact => ({ contact, assessment: assessDigitalSla(contact, now, policy) }));
  const responded = items.map(contact => ({ contact, assessment: assessDigitalSla(contact, now, policy) })).filter(row => row.assessment.responded);
  const channelCounts = Object.fromEntries(Object.keys(DIGITAL_CHANNELS).map(channel => {
    const rows = assessments.filter(row => row.contact.channel === channel);
    return [channel, {
      waiting: rows.filter(row => row.contact.status === DIGITAL_STATUS.QUEUED).length,
      active: rows.filter(row => row.contact.status === DIGITAL_STATUS.ACTIVE).length,
      onTrack: rows.filter(row => row.assessment.status === 'on_track').length,
      atRisk: rows.filter(row => row.assessment.status === 'at_risk').length,
      breached: rows.filter(row => row.assessment.status === 'breached').length,
      firstResponsesMet: responded.filter(row => row.contact.channel === channel && row.assessment.status === 'met').length,
      firstResponsesLate: responded.filter(row => row.contact.channel === channel && row.assessment.status === 'breached').length
    }];
  }));
  const met = responded.filter(row => row.assessment.status === 'met').length;
  const late = responded.filter(row => row.assessment.status === 'breached').length;
  const responseTimes = responded.map(row => row.assessment.responseMinutes).filter(Number.isFinite);
  return {
    version: DIGITAL_SLA_VERSION,
    open: open.length,
    onTrack: assessments.filter(row => row.assessment.status === 'on_track').length,
    atRisk: assessments.filter(row => row.assessment.status === 'at_risk').length,
    breached: assessments.filter(row => row.assessment.status === 'breached').length,
    firstResponses: responded.length,
    firstResponsesMet: met,
    firstResponsesLate: late,
    firstResponseTargetRate: responded.length ? Math.round(met / responded.length * 100) : null,
    averageFirstResponseMinutes: responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length * 10) / 10 : 0,
    channelCounts
  };
}
