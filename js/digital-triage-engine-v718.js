/**
 * CALLORIA v7.18 — SLA-aware digital queue triage.
 * Pure ranking helpers for synthetic local work. The host application supplies
 * its existing queue sorter and SLA assessor so no second SLA policy is created.
 */
export const DIGITAL_TRIAGE_VERSION = '7.18.0';
export const DIGITAL_TRIAGE_POLICY = Object.freeze({
  agingStepSeconds: 15 * 60,
  maximumAgingBoost: 3
});

const SUPPORTED_CHANNELS = new Set(['email', 'live_chat', 'social']);
const SLA_ORDER = Object.freeze({ breached: 0, at_risk: 1, on_track: 2, met: 2, unavailable: 3 });
const PRIORITY_WEIGHT = Object.freeze({ critical: 3, high: 2, normal: 1, low: 0 });

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dependencies(options) {
  if (typeof options?.baseSorter !== 'function' || typeof options?.slaAssessor !== 'function') {
    throw new TypeError('Digital SLA triage requires the existing sortDigitalQueue and assessDigitalSla functions.');
  }
  return { baseSorter: options.baseSorter, slaAssessor: options.slaAssessor };
}

function waitSeconds(contact, now) {
  const receivedAt = Date.parse(contact?.receivedAt || '');
  if (!Number.isFinite(receivedAt)) return 0;
  return Math.max(0, Math.floor((now - receivedAt) / 1000));
}

function triageReason(status, agingBoost) {
  if (status === 'breached') return 'SLA BREACHED · RECOVERY FIRST';
  if (status === 'at_risk') return 'SLA DUE SOON';
  if (agingBoost > 0) return `AGING QUEUE · +${agingBoost} PRIORITY`;
  if (status === 'unavailable') return 'SLA TIME UNAVAILABLE';
  return 'ON TRACK';
}

/**
 * Return queued digital contacts in SLA-first order. The source queue is never
 * mutated. SLA urgency is the primary key; ageing is a bounded fairness boost
 * within the same SLA band, followed by business priority and oldest receipt.
 */
export function sortDigitalQueueBySla(queue, options = {}) {
  const now = Math.max(0, finite(options.now, Date.now()));
  const channel = options.channel || 'all';
  const { baseSorter, slaAssessor } = dependencies(options);
  const base = baseSorter(queue, { channel, now });
  const ranked = (Array.isArray(base) ? base : []).map(contact => {
    const assessment = slaAssessor(contact, now, options.policy);
    const ageSeconds = waitSeconds(contact, now);
    const agingBoost = Math.min(
      DIGITAL_TRIAGE_POLICY.maximumAgingBoost,
      Math.floor(ageSeconds / DIGITAL_TRIAGE_POLICY.agingStepSeconds)
    );
    const rawStatus = String(assessment?.status || 'unavailable');
    const status = Object.hasOwn(SLA_ORDER, rawStatus) ? rawStatus : 'unavailable';
    return {
      ...contact,
      waitSeconds: ageSeconds,
      triageStatus: status,
      triageReason: triageReason(status, agingBoost),
      triageAgingBoost: agingBoost,
      triagePriorityScore: (PRIORITY_WEIGHT[contact.priority] ?? 1) + agingBoost,
      triageSlaRank: SLA_ORDER[status] ?? SLA_ORDER.unavailable,
      triageAssessment: assessment
    };
  });

  ranked.sort((a, b) =>
    a.triageSlaRank - b.triageSlaRank
    || b.triagePriorityScore - a.triagePriorityScore
    || b.waitSeconds - a.waitSeconds
    || (PRIORITY_WEIGHT[b.priority] ?? 1) - (PRIORITY_WEIGHT[a.priority] ?? 1)
    || String(a.id).localeCompare(String(b.id))
  );
  return ranked;
}

/** Compact snapshot for digital workspace/supervisor summaries. */
export function digitalTriageSnapshot(queue, options = {}) {
  const ranked = sortDigitalQueueBySla(queue, options);
  const counts = {
    waiting: ranked.length,
    breached: ranked.filter(item => item.triageStatus === 'breached').length,
    atRisk: ranked.filter(item => item.triageStatus === 'at_risk').length,
    onTrack: ranked.filter(item => item.triageStatus === 'on_track' || item.triageStatus === 'met').length,
    unavailable: ranked.filter(item => item.triageStatus === 'unavailable').length,
    aged: ranked.filter(item => item.triageAgingBoost > 0).length
  };
  const byChannel = Object.fromEntries([...SUPPORTED_CHANNELS].map(channel => [channel, {
    waiting: ranked.filter(item => item.channel === channel).length,
    breached: ranked.filter(item => item.channel === channel && item.triageStatus === 'breached').length,
    atRisk: ranked.filter(item => item.channel === channel && item.triageStatus === 'at_risk').length
  }]));
  return {
    version: DIGITAL_TRIAGE_VERSION,
    counts,
    byChannel,
    next: ranked[0] || null,
    topItems: ranked.slice(0, 5),
    ranked
  };
}

/** Explain why a queued contact occupies its current triage position. */
export function digitalTriageExplanation(contact) {
  if (!contact || typeof contact !== 'object') return 'No triage details available.';
  const channelNames = { email: 'Email', live_chat: 'Live chat', social: 'Social' };
  const channel = channelNames[contact.channel] || 'Digital';
  const state = contact.triageStatus || 'unavailable';
  const wait = Math.max(0, Math.floor(finite(contact.waitSeconds, 0)));
  const minutes = Math.floor(wait / 60);
  const seconds = wait % 60;
  return `${channel} · ${String(state).replaceAll('_', ' ')} · waiting ${minutes}m ${seconds}s · ${contact.triageReason || 'standard queue order'}`;
}

export function isDigitalTriageCandidate(contact) {
  return Boolean(contact && contact.status === 'queued' && SUPPORTED_CHANNELS.has(contact.channel));
}
