/**
 * CALLORIA v6.73 — Supervisor Shift Handover & Outstanding Work Continuity
 * Local, synthetic handovers. No external identity, workforce or notification service is called.
 */

import { normalizeSupervisorEscalation } from './supervisor-escalation-engine.js';

export const SUPERVISOR_HANDOVER_VERSION = '6.73.0';
export const SUPERVISOR_HANDOVER_STATUSES = Object.freeze(['pending_acceptance', 'accepted', 'cancelled']);
export const SUPERVISOR_HANDOVER_ITEM_STATUSES = Object.freeze(['pending', 'transferred', 'stale']);
const MAX_HISTORY = 40;
const MAX_HANDOVERS = 100;

function clean(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function validDate(value, fallback = Date.now()) {
  const date = value instanceof Date ? value : new Date(value == null ? fallback : value);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function appendHistory(record, event) {
  record.history = Array.isArray(record.history) ? record.history : [];
  record.history.unshift(event);
  record.history = record.history.slice(0, MAX_HISTORY);
}

function sameName(left, right) {
  return clean(left, 100).toLocaleLowerCase() === clean(right, 100).toLocaleLowerCase();
}

function makeHandoverId(existing, at) {
  const stamp = validDate(at).getTime();
  let sequence = 1;
  let candidate = `HO-${stamp}-${sequence}`;
  const ids = new Set((Array.isArray(existing) ? existing : []).map(item => clean(item?.id, 120)));
  while (ids.has(candidate)) {
    sequence += 1;
    candidate = `HO-${stamp}-${sequence}`;
  }
  return candidate;
}

export function normalizeSupervisorHandover(handover, now = new Date()) {
  if (!handover || typeof handover !== 'object' || Array.isArray(handover)) {
    throw new TypeError('A supervisor handover record is required.');
  }
  const current = validDate(now);
  const createdAt = validDate(handover.createdAt, current.getTime()).toISOString();
  const status = SUPERVISOR_HANDOVER_STATUSES.includes(handover.status)
    ? handover.status
    : 'pending_acceptance';
  const items = Array.isArray(handover.items) ? handover.items : [];
  const normalizedItems = items
    .filter(item => item && typeof item === 'object' && !Array.isArray(item) && clean(item.requestId, 120))
    .map(item => ({
      requestId: clean(item.requestId, 120),
      customer: clean(item.customer, 140),
      reference: clean(item.reference, 120),
      channel: clean(item.channel, 80),
      reason: clean(item.reason, 400),
      priority: ['critical', 'high', 'normal'].includes(item.priority) ? item.priority : 'normal',
      targetMinutes: Math.max(1, Math.min(240, Math.floor(Number(item.targetMinutes) || 30))),
      originalOwner: clean(item.originalOwner || handover.fromSupervisor, 100),
      status: SUPERVISOR_HANDOVER_ITEM_STATUSES.includes(item.status) ? item.status : 'pending',
      transferredAt: item.transferredAt ? validDate(item.transferredAt, current.getTime()).toISOString() : null,
      staleReason: clean(item.staleReason, 240)
    }));

  Object.assign(handover, {
    version: SUPERVISOR_HANDOVER_VERSION,
    id: clean(handover.id, 120),
    fromSupervisor: clean(handover.fromSupervisor, 100),
    toSupervisor: clean(handover.toSupervisor, 100),
    note: clean(handover.note, 1000),
    createdAt,
    status,
    items: normalizedItems,
    acceptedAt: handover.acceptedAt ? validDate(handover.acceptedAt, current.getTime()).toISOString() : null,
    acceptedBy: clean(handover.acceptedBy, 100),
    cancelledAt: handover.cancelledAt ? validDate(handover.cancelledAt, current.getTime()).toISOString() : null,
    cancelledBy: clean(handover.cancelledBy, 100),
    cancellationReason: clean(handover.cancellationReason, 400),
    history: Array.isArray(handover.history) ? handover.history.slice(0, MAX_HISTORY) : []
  });
  return handover;
}

export function normalizeSupervisorHandovers(handovers = [], now = new Date()) {
  if (!Array.isArray(handovers)) return [];
  return handovers
    .filter(item => item && typeof item === 'object' && !Array.isArray(item) && clean(item.id, 120))
    .slice(-MAX_HANDOVERS)
    .map(item => normalizeSupervisorHandover(item, now));
}

function pendingRequestIds(handovers = []) {
  const ids = new Set();
  for (const handover of normalizeSupervisorHandovers(handovers)) {
    if (handover.status !== 'pending_acceptance') continue;
    for (const item of handover.items) if (item.status === 'pending') ids.add(item.requestId);
  }
  return ids;
}

export function supervisorHandoverCandidates(requests = [], handovers = [], outgoingSupervisor, now = new Date()) {
  const owner = clean(outgoingSupervisor, 100);
  if (owner.length < 2) return [];
  const alreadyPending = pendingRequestIds(handovers);
  const list = Array.isArray(requests) ? requests : [];
  const candidates = [];
  for (const request of list) {
    if (!request || typeof request !== 'object' || Array.isArray(request) || request.status !== 'open') continue;
    const normalizedRequest = normalizeSupervisorEscalation(request, now);
    const escalation = normalizedRequest.escalation;
    if (!sameName(escalation.assignedTo || request.assignedTo, owner) || alreadyPending.has(clean(request.id, 120))) continue;
    candidates.push({
      requestId: clean(request.id, 120),
      customer: clean(request.customer || 'Synthetic customer', 140),
      reference: clean(request.reference || request.contactId || request.id, 120),
      channel: clean(request.channel || 'Customer contact', 80),
      reason: clean(request.reason || 'Supervisor follow-up required.', 400),
      priority: ['critical', 'high', 'normal'].includes(escalation.priority || request.priority) ? (escalation.priority || request.priority) : 'normal',
      targetMinutes: Math.max(1, Math.min(240, Math.floor(Number(escalation.targetMinutes) || 30))),
      originalOwner: owner,
      createdAt: validDate(request.createdAt, validDate(now).getTime()).toISOString()
    });
  }
  const rank = { critical: 0, high: 1, normal: 2 };
  return candidates.sort((a, b) => rank[a.priority] - rank[b.priority] || Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function createSupervisorHandover(requests, handovers = [], input = {}, now = new Date()) {
  if (!Array.isArray(requests)) throw new TypeError('Supervisor requests must be an array.');
  if (!Array.isArray(handovers)) throw new TypeError('Supervisor handovers must be an array.');
  const fromSupervisor = clean(input.fromSupervisor, 100);
  const toSupervisor = clean(input.toSupervisor, 100);
  const note = clean(input.note, 1000);
  if (fromSupervisor.length < 2) throw new Error('Enter the outgoing supervisor name.');
  if (toSupervisor.length < 2) throw new Error('Enter the incoming supervisor name.');
  if (sameName(fromSupervisor, toSupervisor)) throw new Error('The incoming supervisor must be different from the outgoing supervisor.');
  if (note.length < 20) throw new Error('Record at least 20 characters explaining the shift handover.');

  const at = validDate(now).toISOString();
  const candidates = supervisorHandoverCandidates(requests, handovers, fromSupervisor, at);
  if (!candidates.length) throw new Error('There are no eligible open escalations owned by this supervisor to hand over.');
  const existingIds = new Set(handovers.map(item => clean(item?.id, 120)));
  const requestedId = clean(input.id, 120);
  const id = requestedId || makeHandoverId(handovers, at);
  if (existingIds.has(id)) throw new Error('A handover with this reference already exists.');

  const handover = {
    id,
    fromSupervisor,
    toSupervisor,
    note,
    createdAt: at,
    status: 'pending_acceptance',
    items: candidates.map(item => ({ ...item, status: 'pending', transferredAt: null, staleReason: '' })),
    acceptedAt: null,
    acceptedBy: '',
    cancelledAt: null,
    cancelledBy: '',
    cancellationReason: '',
    history: [{ at, action: 'created', actor: fromSupervisor, summary: note }]
  };
  return normalizeSupervisorHandover(handover, at);
}

function appendRequestHistory(escalation, event) {
  escalation.history = Array.isArray(escalation.history) ? escalation.history : [];
  escalation.history.unshift(event);
  escalation.history = escalation.history.slice(0, MAX_HISTORY);
}

export function acceptSupervisorHandover(requests, handovers, handoverId, actor, now = new Date()) {
  if (!Array.isArray(requests) || !Array.isArray(handovers)) throw new TypeError('Supervisor request and handover lists are required.');
  const handover = handovers.find(item => item && item.id === handoverId);
  if (!handover) throw new Error('Supervisor handover was not found.');
  normalizeSupervisorHandover(handover, now);
  if (handover.status !== 'pending_acceptance') throw new Error('Only a pending handover can be accepted.');
  const acceptedBy = clean(actor, 100);
  if (acceptedBy.length < 2 || !sameName(acceptedBy, handover.toSupervisor)) {
    throw new Error(`This handover must be accepted by ${handover.toSupervisor}.`);
  }

  const at = validDate(now).toISOString();
  let transferred = 0;
  let stale = 0;
  for (const item of handover.items) {
    if (item.status !== 'pending') continue;
    const request = requests.find(row => row && row.id === item.requestId);
    if (!request) {
      item.status = 'stale';
      item.staleReason = 'The supervisor request no longer exists.';
      stale += 1;
      continue;
    }
    normalizeSupervisorEscalation(request, now);
    const escalation = request.escalation;
    if (request.status !== 'open') {
      item.status = 'stale';
      item.staleReason = 'The supervisor request was closed before handover acceptance.';
      stale += 1;
      continue;
    }
    if (!sameName(escalation.assignedTo || request.assignedTo, handover.fromSupervisor)) {
      item.status = 'stale';
      item.staleReason = 'The supervisor request owner changed before handover acceptance.';
      stale += 1;
      continue;
    }

    const from = clean(escalation.assignedTo || request.assignedTo, 100);
    escalation.assignedTo = handover.toSupervisor;
    escalation.stage = 'acknowledged';
    escalation.acknowledgedAt = at;
    escalation.startedAt = null;
    request.escalation = escalation;
    item.status = 'transferred';
    item.transferredAt = at;
    appendRequestHistory(escalation, {
      at,
      action: 'shift_handover_accepted',
      actor: acceptedBy,
      from,
      to: handover.toSupervisor,
      handoverId: handover.id,
      summary: handover.note
    });
    transferred += 1;
  }

  handover.status = 'accepted';
  handover.acceptedAt = at;
  handover.acceptedBy = acceptedBy;
  appendHistory(handover, {
    at,
    action: 'accepted',
    actor: acceptedBy,
    transferred,
    stale,
    summary: `Accepted shift handover: ${transferred} escalation(s) transferred; ${stale} item(s) no longer eligible.`
  });
  return { handover, transferred, stale };
}

export function cancelSupervisorHandover(handovers, handoverId, actor, reason, now = new Date()) {
  if (!Array.isArray(handovers)) throw new TypeError('Supervisor handovers must be an array.');
  const handover = handovers.find(item => item && item.id === handoverId);
  if (!handover) throw new Error('Supervisor handover was not found.');
  normalizeSupervisorHandover(handover, now);
  if (handover.status !== 'pending_acceptance') throw new Error('Only a pending handover can be cancelled.');
  const cancelledBy = clean(actor, 100);
  const cancellationReason = clean(reason, 400);
  if (cancelledBy.length < 2 || !sameName(cancelledBy, handover.fromSupervisor)) {
    throw new Error('Only the outgoing supervisor can cancel this pending handover.');
  }
  if (cancellationReason.length < 10) throw new Error('Record at least 10 characters explaining why the handover was cancelled.');
  const at = validDate(now).toISOString();
  handover.status = 'cancelled';
  handover.cancelledAt = at;
  handover.cancelledBy = cancelledBy;
  handover.cancellationReason = cancellationReason;
  for (const item of handover.items) if (item.status === 'pending') item.status = 'stale';
  appendHistory(handover, { at, action: 'cancelled', actor: cancelledBy, summary: cancellationReason });
  return handover;
}

export function supervisorHandoverMetrics(handovers = []) {
  const list = normalizeSupervisorHandovers(handovers);
  const allItems = list.flatMap(item => item.items);
  return {
    total: list.length,
    pending: list.filter(item => item.status === 'pending_acceptance').length,
    accepted: list.filter(item => item.status === 'accepted').length,
    cancelled: list.filter(item => item.status === 'cancelled').length,
    pendingItems: allItems.filter(item => item.status === 'pending').length,
    transferredItems: allItems.filter(item => item.status === 'transferred').length,
    staleItems: allItems.filter(item => item.status === 'stale').length
  };
}
