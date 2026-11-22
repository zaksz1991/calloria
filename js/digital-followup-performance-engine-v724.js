/**
 * CALLORIA v7.24 — digital follow-up response performance analytics.
 * Pure, local simulation analytics. No provider/customer data is transmitted.
 * Completed cycles are attributed to the agentId recorded on the response
 * message; still-open cycles use the contact's current assignedTo value.
 */
import { assessDigitalResponseCycles } from './digital-response-cycle-engine-v721.js';

export const DIGITAL_FOLLOWUP_PERFORMANCE_VERSION = '7.24.0';
const CHANNELS = Object.freeze(['email', 'live_chat', 'social']);
const UNASSIGNED = 'UNASSIGNED';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normaliseAgentId(value) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 80) : UNASSIGNED;
}

function responseAgentForCycle(contact, cycle) {
  const messages = Array.isArray(contact?.messages) ? contact.messages : [];
  const customerIndex = messages.findIndex(message => String(message?.id ?? '') === String(cycle?.id ?? ''));
  if (customerIndex >= 0) {
    for (let index = customerIndex + 1; index < messages.length; index += 1) {
      const message = messages[index];
      if (message?.type === 'customer') break;
      if (message?.type === 'agent') {
        const responseAgent = normaliseAgentId(message.agentId);
        if (responseAgent !== UNASSIGNED) return responseAgent;
        break;
      }
    }
  }
  return normaliseAgentId(contact?.assignedTo);
}

function createAccumulator(id) {
  return {
    agentId: id,
    totalCycles: 0,
    completed: 0,
    met: 0,
    late: 0,
    open: 0,
    onTrack: 0,
    atRisk: 0,
    overdue: 0,
    responseMinutes: [],
    byChannel: Object.fromEntries(CHANNELS.map(channel => [channel, {
      total: 0, completed: 0, met: 0, late: 0, open: 0, overdue: 0
    }]))
  };
}

function addCycle(accumulator, cycle) {
  const channel = CHANNELS.includes(cycle.channel) ? cycle.channel : null;
  accumulator.totalCycles += 1;
  if (channel) accumulator.byChannel[channel].total += 1;

  if (cycle.responded) {
    accumulator.completed += 1;
    if (channel) accumulator.byChannel[channel].completed += 1;
    if (cycle.status === 'met') {
      accumulator.met += 1;
      if (channel) accumulator.byChannel[channel].met += 1;
    } else if (cycle.status === 'breached') {
      accumulator.late += 1;
      if (channel) accumulator.byChannel[channel].late += 1;
    }
    if (Number.isFinite(cycle.responseMinutes)) accumulator.responseMinutes.push(cycle.responseMinutes);
    return;
  }

  accumulator.open += 1;
  if (channel) accumulator.byChannel[channel].open += 1;
  if (cycle.status === 'on_track') accumulator.onTrack += 1;
  if (cycle.status === 'at_risk') accumulator.atRisk += 1;
  if (cycle.status === 'breached') {
    accumulator.overdue += 1;
    if (channel) accumulator.byChannel[channel].overdue += 1;
  }
}

function finishAccumulator(row) {
  const responseTargetRate = row.completed
    ? Math.round((row.met / row.completed) * 100)
    : null;
  const averageResponseMinutes = row.responseMinutes.length
    ? Math.round((row.responseMinutes.reduce((sum, value) => sum + value, 0) / row.responseMinutes.length) * 10) / 10
    : null;
  const byChannel = Object.fromEntries(CHANNELS.map(channel => {
    const metrics = row.byChannel[channel];
    return [channel, {
      ...metrics,
      responseTargetRate: metrics.completed
        ? Math.round((metrics.met / metrics.completed) * 100)
        : null
    }];
  }));
  return {
    agentId: row.agentId,
    totalCycles: row.totalCycles,
    completed: row.completed,
    met: row.met,
    late: row.late,
    responseTargetRate,
    averageResponseMinutes,
    open: row.open,
    onTrack: row.onTrack,
    atRisk: row.atRisk,
    overdue: row.overdue,
    byChannel
  };
}

/**
 * Build a deterministic performance board from retained synthetic digital
 * contacts. Completed cycles use the responding message's agentId. Open cycles
 * use contact.assignedTo, so reassignment history is not inferred or invented.
 */
export function digitalFollowUpPerformanceBoard(queue, now = Date.now()) {
  const contacts = Array.isArray(queue) ? queue : [];
  const safeNow = Math.max(0, finite(now, Date.now()));
  const groups = new Map();
  const overall = createAccumulator('ALL_AGENTS');

  for (const contact of contacts) {
    if (!contact || typeof contact !== 'object' || Array.isArray(contact)) continue;
    const report = assessDigitalResponseCycles(contact, safeNow);
    for (const cycle of report.cycles) {
      const agentId = responseAgentForCycle(contact, cycle);
      if (!groups.has(agentId)) groups.set(agentId, createAccumulator(agentId));
      addCycle(groups.get(agentId), { ...cycle, channel: contact.channel });
      addCycle(overall, { ...cycle, channel: contact.channel });
    }
  }

  const agents = [...groups.values()].map(finishAccumulator).sort((a, b) =>
    b.overdue - a.overdue
      || b.atRisk - a.atRisk
      || (a.responseTargetRate ?? 101) - (b.responseTargetRate ?? 101)
      || b.completed - a.completed
      || a.agentId.localeCompare(b.agentId)
  );
  const summary = finishAccumulator(overall);

  return {
    version: DIGITAL_FOLLOWUP_PERFORMANCE_VERSION,
    totalCycles: summary.totalCycles,
    completed: summary.completed,
    met: summary.met,
    late: summary.late,
    responseTargetRate: summary.responseTargetRate,
    averageResponseMinutes: summary.averageResponseMinutes,
    open: summary.open,
    onTrack: summary.onTrack,
    atRisk: summary.atRisk,
    overdue: summary.overdue,
    byChannel: summary.byChannel,
    agents,
    attribution: 'Responded cycles use the responding message agentId; open cycles use current contact assignedTo.'
  };
}

export function digitalFollowUpPerformanceDisplay(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Math.round(Number(value))}%`;
}
