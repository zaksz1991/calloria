/**
 * CALLORIA v7.23 — supervisor visibility for unanswered digital follow-ups.
 * Pure, local simulation logic. No customer/provider data is transmitted.
 */
import { assessDigitalResponseCycles } from './digital-response-cycle-engine-v721.js';

export const DIGITAL_FOLLOWUP_SUPERVISOR_VERSION = '7.23.0';
const OPEN_CONTACT_STATES = new Set(['active', 'awaiting_customer']);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeDate(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Produce supervisor-ready alerts for unanswered customer follow-up bursts.
 * A contact is included only while open and only while a follow-up response
 * cycle is still unanswered and at-risk or overdue. The function never mutates
 * the queue, message history, or supervisor request list.
 */
export function digitalFollowUpSupervisorBoard(queue, requests = [], now = Date.now()) {
  const contacts = Array.isArray(queue) ? queue : [];
  const supervisorRequests = Array.isArray(requests) ? requests : [];
  const safeNow = Math.max(0, finite(now, Date.now()));
  const rows = [];

  for (const contact of contacts) {
    if (!contact || !OPEN_CONTACT_STATES.has(String(contact.status || ''))) continue;
    const report = assessDigitalResponseCycles(contact, safeNow);
    for (const cycle of report.cycles) {
      if (cycle.responded || !['at_risk', 'breached'].includes(cycle.status)) continue;
      const hasOpenRequest = supervisorRequests.some(request =>
        request && request.contactId === contact.id && request.status === 'open'
      );
      rows.push({
        contactId: String(contact.id || ''),
        cycleId: String(cycle.id || ''),
        sequence: Math.max(1, Math.floor(finite(cycle.sequence, 1))),
        customer: String(contact.customer || 'Synthetic customer'),
        subject: String(contact.subject || 'Digital customer follow-up'),
        channel: String(contact.channelLabel || contact.channel || 'Digital'),
        assignedTo: String(contact.assignedTo || ''),
        status: cycle.status,
        targetMinutes: Math.max(1, finite(cycle.targetMinutes, 1)),
        dueAt: cycle.dueAt,
        receivedAt: cycle.receivedAt,
        remainingMinutes: cycle.responded ? 0 : Math.max(0, Math.ceil(finite(cycle.remainingMs) / 60_000)),
        overdueMinutes: Math.max(0, Math.ceil(finite(cycle.overdueMs) / 60_000)),
        customerMessageCount: Math.max(1, Math.floor(finite(cycle.customerMessageCount, 1))),
        hasOpenRequest
      });
    }
  }

  rows.sort((a, b) => {
    const stateRank = (a.status === 'breached' ? 0 : 1) - (b.status === 'breached' ? 0 : 1);
    if (stateRank) return stateRank;
    const timeRank = a.status === 'breached'
      ? b.overdueMinutes - a.overdueMinutes
      : a.remainingMinutes - b.remainingMinutes;
    if (timeRank) return timeRank;
    return a.contactId.localeCompare(b.contactId) || a.sequence - b.sequence;
  });

  const overdue = rows.filter(row => row.status === 'breached').length;
  const dueSoon = rows.filter(row => row.status === 'at_risk').length;
  const alreadyEscalated = rows.filter(row => row.hasOpenRequest).length;
  const byChannel = Object.fromEntries(['email', 'live_chat', 'social'].map(channel => {
    const channelRows = rows.filter(row => row.channel.toLowerCase().replaceAll(' ', '_') === channel
      || (channel === 'live_chat' && row.channel.toLowerCase() === 'live chat'));
    return [channel, {
      total: channelRows.length,
      overdue: channelRows.filter(row => row.status === 'breached').length,
      dueSoon: channelRows.filter(row => row.status === 'at_risk').length
    }];
  }));

  return {
    version: DIGITAL_FOLLOWUP_SUPERVISOR_VERSION,
    total: rows.length,
    overdue,
    dueSoon,
    alreadyEscalated,
    unraised: rows.filter(row => !row.hasOpenRequest).length,
    byChannel,
    rows
  };
}

/** Revalidate one alert against the live queue before the UI creates a request. */
export function findDigitalFollowUpSupervisorAlert(queue, requests, contactId, cycleId, now = Date.now()) {
  const board = digitalFollowUpSupervisorBoard(queue, requests, now);
  return board.rows.find(row => row.contactId === String(contactId || '')
    && row.cycleId === String(cycleId || '')) || null;
}
