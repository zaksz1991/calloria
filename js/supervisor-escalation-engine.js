/**
 * CALLORIA v6.72 — Supervisor Escalation Ownership & Response Control
 * Local synthetic supervisor requests only. No external workforce or CRM is called.
 */

export const SUPERVISOR_ESCALATION_VERSION = '6.72.0';
export const SUPERVISOR_ESCALATION_PRIORITIES = Object.freeze(['critical', 'high', 'normal']);
export const SUPERVISOR_ESCALATION_RESOLUTIONS = Object.freeze(['action_taken', 'referred', 'no_action_required']);
export const SUPERVISOR_ESCALATION_TARGET_MINUTES = Object.freeze({ critical: 5, high: 15, normal: 30 });
const MAX_HISTORY = 40;

function clean(value, max = 300) {
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

function derivePriority(request) {
  const text = `${request.reason || ''} ${request.channel || ''} ${request.reference || ''}`.toLowerCase();
  if (/fraud|security|credential|password|\bpin\b|\botp\b|data breach|safeguard|safety|threat|harm|critical compliance|unauthori[sz]ed/.test(text)) return 'critical';
  if (/case follow-up|case follow up|callback|promise|repeat|complaint|failed resolution|service failure|specialist|qa review|quality review/.test(text)) return 'high';
  return 'normal';
}

function appendHistory(escalation, event) {
  escalation.history = Array.isArray(escalation.history) ? escalation.history : [];
  escalation.history.unshift(event);
  escalation.history = escalation.history.slice(0, MAX_HISTORY);
}

export function normalizeSupervisorEscalation(request, now = new Date()) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('A supervisor request record is required.');
  }
  const current = validDate(now);
  const existing = request.escalation && typeof request.escalation === 'object' && !Array.isArray(request.escalation)
    ? request.escalation
    : {};
  const createdAt = validDate(request.createdAt, current.getTime()).toISOString();
  const derived = derivePriority(request);
  const priority = SUPERVISOR_ESCALATION_PRIORITIES.includes(existing.priority)
    ? existing.priority
    : (SUPERVISOR_ESCALATION_PRIORITIES.includes(request.priority) ? request.priority : derived);
  const targetMinutes = Math.max(1, Math.min(240, Math.floor(Number(existing.targetMinutes) || SUPERVISOR_ESCALATION_TARGET_MINUTES[priority])));
  const assignedTo = clean(existing.assignedTo || request.assignedTo, 100);
  const closed = request.status === 'resolved' || existing.stage === 'resolved';
  const stage = existing.stage === 'resolved' || (request.status === 'resolved' && !existing.stage)
    ? 'resolved'
    : (['new', 'acknowledged', 'in_progress'].includes(existing.stage) ? existing.stage : assignedTo ? 'acknowledged' : 'new');
  request.escalation = {
    version: SUPERVISOR_ESCALATION_VERSION,
    priority,
    targetMinutes,
    assignedTo,
    stage,
    acknowledgedAt: existing.acknowledgedAt || null,
    startedAt: existing.startedAt || null,
    resolvedAt: existing.resolvedAt || request.resolvedAt || null,
    resolvedBy: clean(existing.resolvedBy || request.resolvedBy, 100),
    resolution: clean(existing.resolution || request.resolution, 80),
    resolutionEvidence: clean(existing.resolutionEvidence, 1000),
    history: Array.isArray(existing.history) ? existing.history.slice(0, MAX_HISTORY) : []
  };
  if (closed) request.status = 'resolved';
  else if (!request.status) request.status = 'open';
  request.createdAt = createdAt;
  request.priority = priority;
  return request;
}

export function normalizeSupervisorRequests(requests = [], now = new Date()) {
  if (!Array.isArray(requests)) return [];
  return requests.filter(item => item && typeof item === 'object' && !Array.isArray(item) && clean(item.id, 120))
    .map(item => normalizeSupervisorEscalation(item, now));
}

export function assessSupervisorEscalation(request, now = new Date()) {
  const item = normalizeSupervisorEscalation(request, now);
  const escalation = item.escalation;
  const created = validDate(item.createdAt).getTime();
  const nowMs = validDate(now).getTime();
  const targetMs = escalation.targetMinutes * 60_000;
  const elapsedMs = Math.max(0, nowMs - created);
  const remainingMs = targetMs - elapsedMs;
  let state = 'on_track';
  if (item.status === 'resolved' || escalation.stage === 'resolved') state = 'resolved';
  else if (remainingMs <= 0) state = 'overdue';
  else if (remainingMs <= Math.min(5 * 60_000, targetMs * 0.25)) state = 'due_soon';
  return {
    state,
    priority: escalation.priority,
    targetMinutes: escalation.targetMinutes,
    elapsedMinutes: Math.floor(elapsedMs / 60_000),
    remainingMinutes: state === 'overdue' ? 0 : Math.ceil(remainingMs / 60_000),
    assigned: Boolean(escalation.assignedTo),
    stage: escalation.stage
  };
}

export function claimSupervisorEscalation(requests, requestId, actor, now = new Date()) {
  const list = normalizeSupervisorRequests(requests, now);
  const request = list.find(item => item.id === requestId && item.status === 'open');
  if (!request) throw new Error('The supervisor request is no longer open.');
  const name = clean(actor, 100);
  if (name.length < 2) throw new Error('Enter the name of the supervisor claiming this request.');
  const escalation = request.escalation;
  if (escalation.assignedTo && escalation.assignedTo.toLowerCase() !== name.toLowerCase()) {
    throw new Error(`This request is already owned by ${escalation.assignedTo}.`);
  }
  const at = validDate(now).toISOString();
  if (!escalation.assignedTo) {
    escalation.assignedTo = name;
    escalation.acknowledgedAt = at;
    escalation.stage = 'acknowledged';
    appendHistory(escalation, { at, action: 'claimed', actor: name, summary: 'Supervisor accepted ownership of the escalation.' });
  }
  if (!escalation.startedAt) {
    escalation.startedAt = at;
    escalation.stage = 'in_progress';
    appendHistory(escalation, { at, action: 'review_started', actor: name, summary: 'Supervisor began reviewing the escalation.' });
  }
  return request;
}

export function reassignSupervisorEscalation(requests, requestId, actor, input = {}, now = new Date()) {
  const list = normalizeSupervisorRequests(requests, now);
  const request = list.find(item => item.id === requestId && item.status === 'open');
  if (!request) throw new Error('The supervisor request is no longer open.');
  const currentActor = clean(actor, 100);
  const nextOwner = clean(input.newOwner, 100);
  const reason = clean(input.reason, 400);
  if (currentActor.length < 2 || request.escalation.assignedTo.toLowerCase() !== currentActor.toLowerCase()) {
    throw new Error('Only the currently assigned supervisor can reassign this request.');
  }
  if (nextOwner.length < 2) throw new Error('Enter the next supervisor owner.');
  if (nextOwner.toLowerCase() === currentActor.toLowerCase()) throw new Error('Choose a different supervisor for reassignment.');
  if (reason.length < 8) throw new Error('Explain the reassignment in at least 8 characters.');
  const at = validDate(now).toISOString();
  const from = request.escalation.assignedTo;
  request.escalation.assignedTo = nextOwner;
  request.escalation.stage = 'acknowledged';
  request.escalation.startedAt = null;
  appendHistory(request.escalation, { at, action: 'reassigned', actor: currentActor, from, to: nextOwner, summary: reason });
  return request;
}

export function resolveSupervisorEscalation(requests, requestId, actor, input = {}, now = new Date()) {
  const list = normalizeSupervisorRequests(requests, now);
  const request = list.find(item => item.id === requestId && item.status === 'open');
  if (!request) throw new Error('The supervisor request is no longer open.');
  const name = clean(actor, 100);
  const outcome = String(input.outcome || '');
  const evidence = clean(input.evidence, 1000);
  if (name.length < 2 || request.escalation.assignedTo.toLowerCase() !== name.toLowerCase()) {
    throw new Error('Claim this escalation before recording its supervisor decision.');
  }
  if (!SUPERVISOR_ESCALATION_RESOLUTIONS.includes(outcome)) throw new Error('Choose a valid supervisor resolution.');
  if (evidence.length < 30) throw new Error('Record at least 30 characters of supervisor action and evidence.');
  const at = validDate(now).toISOString();
  request.status = 'resolved';
  request.resolvedAt = at;
  request.resolvedBy = name;
  request.resolution = outcome;
  request.escalation.stage = 'resolved';
  request.escalation.resolvedAt = at;
  request.escalation.resolvedBy = name;
  request.escalation.resolution = outcome;
  request.escalation.resolutionEvidence = evidence;
  appendHistory(request.escalation, { at, action: 'resolved', actor: name, outcome, summary: evidence });
  return request;
}

export function closeLinkedSupervisorEscalation(request, input = {}, now = new Date()) {
  const item = normalizeSupervisorEscalation(request, now);
  if (item.status !== 'open' && item.escalation.stage === 'resolved') return item;
  const actor = clean(input.actor, 100);
  const evidence = clean(input.evidence, 1000);
  if (actor.length < 2) throw new Error('A named supervisor reviewer is required.');
  if (!item.escalation.assignedTo) throw new Error('Claim this escalation from the Supervisor desk before completing the linked review.');
  if (item.escalation.assignedTo.toLowerCase() !== actor.toLowerCase()) {
    throw new Error(`This escalation is assigned to ${item.escalation.assignedTo}; the assigned supervisor must complete the linked review.`);
  }
  if (evidence.length < 20) throw new Error('The linked workflow must provide at least 20 characters of review evidence.');
  const at = validDate(now).toISOString();
  item.status = 'resolved';
  item.resolvedAt = at;
  item.resolvedBy = actor;
  item.resolution = 'linked_workflow_review';
  item.escalation.stage = 'resolved';
  item.escalation.resolvedAt = at;
  item.escalation.resolvedBy = actor;
  item.escalation.resolution = 'linked_workflow_review';
  item.escalation.resolutionEvidence = evidence;
  appendHistory(item.escalation, { at, action: 'linked_workflow_resolved', actor, summary: evidence });
  return item;
}

export function supervisorEscalationMetrics(requests = [], now = new Date()) {
  const rows = normalizeSupervisorRequests(requests, now);
  const active = rows.filter(item => item.status === 'open');
  const assessed = active.map(request => ({ request, risk: assessSupervisorEscalation(request, now) }));
  return {
    total: rows.length,
    active: active.length,
    unassigned: active.filter(item => !item.escalation.assignedTo).length,
    critical: active.filter(item => item.escalation.priority === 'critical').length,
    high: active.filter(item => item.escalation.priority === 'high').length,
    overdue: assessed.filter(item => item.risk.state === 'overdue').length,
    dueSoon: assessed.filter(item => item.risk.state === 'due_soon').length,
    inProgress: active.filter(item => item.escalation.stage === 'in_progress').length,
    resolved: rows.filter(item => item.status === 'resolved').length
  };
}
