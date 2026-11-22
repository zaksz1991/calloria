/**
 * CALLORIA v7.21 — follow-up response-cycle SLA assessment.
 * Synthetic simulator records only. No live inbox/provider integration.
 * First-response SLA remains owned by digital-sla-engine.js; this module
 * assesses later customer turns without resetting or rewriting that timer.
 */

export const DIGITAL_RESPONSE_CYCLE_VERSION = '7.21.0';
export const DIGITAL_RESPONSE_CYCLE_TARGETS_MINUTES = Object.freeze({
  email: 240,
  live_chat: 2,
  social: 20
});

const RISK_THRESHOLD = 0.75;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseTimestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function targetFor(contact) {
  const explicit = Number(contact?.slaMinutes);
  const fallback = DIGITAL_RESPONSE_CYCLE_TARGETS_MINUTES[contact?.channel] ?? 20;
  return Math.min(10080, Math.max(1, Number.isFinite(explicit) && explicit > 0 ? explicit : fallback));
}

/**
 * Builds one response cycle per customer-message burst after the first agent
 * reply. A burst ends at the next agent response. Multiple customer messages
 * before one reply are grouped, with the latest customer message starting the
 * response timer. This avoids counting a single pending answer several times.
 */
function collectFollowUpBursts(contact) {
  const messages = Array.isArray(contact?.messages) ? contact.messages : [];
  const firstAgentIndex = messages.findIndex(message => message?.type === 'agent');
  if (firstAgentIndex < 0) return [];

  const bursts = [];
  let cursor = firstAgentIndex + 1;
  while (cursor < messages.length) {
    while (cursor < messages.length && messages[cursor]?.type !== 'customer') cursor += 1;
    if (cursor >= messages.length) break;

    const customerMessages = [];
    while (cursor < messages.length && messages[cursor]?.type === 'customer') {
      customerMessages.push(messages[cursor]);
      cursor += 1;
    }

    let response = null;
    if (cursor < messages.length && messages[cursor]?.type === 'agent') {
      response = messages[cursor];
      cursor += 1;
    }

    const latestCustomerMessage = customerMessages[customerMessages.length - 1];
    bursts.push({
      customerMessage: latestCustomerMessage,
      customerMessageCount: customerMessages.length,
      response
    });

    if (!response) break;
  }
  return bursts;
}

function assessBurst(burst, index, targetMinutes, nowMs, channel) {
  const receivedAtMs = parseTimestamp(burst.customerMessage?.at);
  if (receivedAtMs === null) return null;
  const responseAtMs = parseTimestamp(burst.response?.at);
  const targetMs = targetMinutes * 60_000;
  const dueAtMs = receivedAtMs + targetMs;
  const responded = responseAtMs !== null;
  if (responded && responseAtMs < receivedAtMs) return null;
  const elapsedMs = Math.max(0, (responded ? responseAtMs : nowMs) - receivedAtMs);
  const remainingMs = responded ? 0 : Math.max(0, dueAtMs - nowMs);
  const overdueMs = responded
    ? Math.max(0, responseAtMs - dueAtMs)
    : Math.max(0, nowMs - dueAtMs);

  let status;
  if (responded) status = responseAtMs <= dueAtMs ? 'met' : 'breached';
  else if (nowMs >= dueAtMs) status = 'breached';
  else if (elapsedMs >= targetMs * RISK_THRESHOLD) status = 'at_risk';
  else status = 'on_track';

  return {
    id: String(burst.customerMessage?.id || `follow-up-${index + 1}`),
    sequence: index + 1,
    status,
    label: status === 'met' ? 'Response met target'
      : status === 'breached' ? (responded ? 'Response late' : 'Response overdue')
        : status === 'at_risk' ? 'Response due soon' : 'Response on track',
    channel: String(channel || ''),
    receivedAt: new Date(receivedAtMs).toISOString(),
    dueAt: new Date(dueAtMs).toISOString(),
    respondedAt: responded ? new Date(responseAtMs).toISOString() : null,
    targetMinutes,
    elapsedMs,
    remainingMs,
    overdueMs,
    responseMinutes: responded ? Math.round(elapsedMs / 60_000 * 10) / 10 : null,
    customerMessageCount: burst.customerMessageCount,
    responded
  };
}

/** Pure assessment; it never mutates the contact or its message history. */
export function assessDigitalResponseCycles(contact, now = Date.now()) {
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return { version: DIGITAL_RESPONSE_CYCLE_VERSION, cycles: [], open: 0, onTrack: 0, atRisk: 0, overdue: 0, met: 0, late: 0, averageResponseMinutes: null };
  }
  const safeNow = Math.max(0, finite(now, Date.now()));
  const targetMinutes = targetFor(contact);
  const cycles = collectFollowUpBursts(contact)
    .map((burst, index) => assessBurst(burst, index, targetMinutes, safeNow, contact.channel))
    .filter(Boolean);
  const open = cycles.filter(cycle => !cycle.responded);
  const completed = cycles.filter(cycle => cycle.responded);
  const completedMet = completed.filter(cycle => cycle.status === 'met');
  const completedLate = completed.filter(cycle => cycle.status === 'breached');
  const responseTimes = completed.map(cycle => cycle.responseMinutes).filter(Number.isFinite);
  return {
    version: DIGITAL_RESPONSE_CYCLE_VERSION,
    cycles,
    open: open.length,
    onTrack: open.filter(cycle => cycle.status === 'on_track').length,
    atRisk: open.filter(cycle => cycle.status === 'at_risk').length,
    overdue: open.filter(cycle => cycle.status === 'breached').length,
    met: completedMet.length,
    late: completedLate.length,
    averageResponseMinutes: responseTimes.length
      ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length * 10) / 10
      : null
  };
}

/** Queue-level aggregate for supervisor/performance reporting. */
export function digitalResponseCycleMetrics(queue, now = Date.now()) {
  const contacts = Array.isArray(queue) ? queue : [];
  const reports = contacts.map(contact => ({ contact, report: assessDigitalResponseCycles(contact, now) }));
  const cycles = reports.flatMap(row => row.report.cycles.map(cycle => ({ ...cycle, contactId: row.contact?.id || '', channel: row.contact?.channel || cycle.channel })));
  const open = cycles.filter(cycle => !cycle.responded);
  const completed = cycles.filter(cycle => cycle.responded);
  const met = completed.filter(cycle => cycle.status === 'met');
  const late = completed.filter(cycle => cycle.status === 'breached');
  const responseTimes = completed.map(cycle => cycle.responseMinutes).filter(Number.isFinite);
  return {
    version: DIGITAL_RESPONSE_CYCLE_VERSION,
    totalCycles: cycles.length,
    open: open.length,
    onTrack: open.filter(cycle => cycle.status === 'on_track').length,
    atRisk: open.filter(cycle => cycle.status === 'at_risk').length,
    overdue: open.filter(cycle => cycle.status === 'breached').length,
    met: met.length,
    late: late.length,
    responseTargetRate: completed.length ? Math.round(met.length / completed.length * 100) : null,
    averageResponseMinutes: responseTimes.length
      ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length * 10) / 10
      : null,
    byChannel: Object.fromEntries(['email', 'live_chat', 'social'].map(channel => {
      const rows = cycles.filter(cycle => cycle.channel === channel);
      const done = rows.filter(cycle => cycle.responded);
      const metCount = done.filter(cycle => cycle.status === 'met').length;
      return [channel, {
        total: rows.length,
        open: rows.filter(cycle => !cycle.responded).length,
        overdue: rows.filter(cycle => !cycle.responded && cycle.status === 'breached').length,
        met: metCount,
        late: done.filter(cycle => cycle.status === 'breached').length,
        responseTargetRate: done.length ? Math.round(metCount / done.length * 100) : null
      }];
    }))
  };
}

export function digitalResponseCycleDisplay(cycle) {
  if (!cycle) return 'FOLLOW-UP SLA N/A';
  if (cycle.status === 'met') return `MET · ${cycle.responseMinutes}m`;
  if (cycle.status === 'breached') {
    const minutes = Math.ceil(cycle.overdueMs / 60_000);
    return cycle.responded ? `LATE · ${minutes}m` : `OVERDUE · ${minutes}m`;
  }
  if (cycle.status === 'at_risk') return `DUE · ${Math.max(1, Math.ceil(cycle.remainingMs / 60_000))}m`;
  return `${Math.max(1, Math.ceil((cycle.remainingMs || 0) / 60_000))}m LEFT`;
}
