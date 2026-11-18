/**
 * CALLORIA v6.74 — Agent Shift Handover & Open Work Continuity.
 * Synthetic local gameplay records only; incoming names are not authenticated.
 */

export const AGENT_HANDOVER_VERSION = '6.74.0';
export const AGENT_HANDOVER_ITEM_TYPES = Object.freeze([
  'digital_contact',
  'customer_commitment',
  'case_followup',
  'open_case'
]);

const ACTIVE_DIGITAL = new Set(['active', 'awaiting_customer']);
const ACTIVE_FOLLOWUP = new Set(['open', 'in_progress']);
const TERMINAL_CASE_STATUSES = new Set([
  'resolved', 'completed', 'callback promise fulfilled',
  'callback closed after supervisor review',
  'resolved after reopened follow-up',
  'resolved after supervisor verification'
]);
const MAX_HANDOVERS = 250;
const MAX_ITEMS = 500;
const MAX_HISTORY = 30;

function clean(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function sameName(left, right) {
  return clean(left, 100).toLocaleLowerCase() === clean(right, 100).toLocaleLowerCase();
}

function validDate(value, fallback = Date.now()) {
  const date = value instanceof Date ? value : new Date(value == null ? fallback : value);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid handover timestamp is required.');
  return date;
}

function itemKey(type, id) {
  return `${type}:${clean(id, 140)}`;
}

function pendingItemKeys(handovers) {
  const keys = new Set();
  for (const handover of Array.isArray(handovers) ? handovers : []) {
    if (handover?.status !== 'pending_acceptance') continue;
    for (const item of Array.isArray(handover.items) ? handover.items : []) {
      if (item?.status === 'pending') keys.add(itemKey(item.type, item.itemId));
    }
  }
  return keys;
}

function isOpenCase(record) {
  const status = clean(record?.status, 100).toLowerCase();
  if (!status || TERMINAL_CASE_STATUSES.has(status)) return false;
  return !/(^|\b)(resolved|completed|closed)(\b|$)/i.test(status);
}

function linkedCallbacks(callbacks, { commitmentId = '', caseReference = '' } = {}) {
  return (Array.isArray(callbacks) ? callbacks : [])
    .filter(callback => callback?.status === 'scheduled'
      && ((commitmentId && callback.commitmentId === commitmentId)
        || (caseReference && (callback.caseId === caseReference || callback.reference === caseReference))))
    .map(callback => clean(callback.id, 120)).filter(Boolean).slice(0, 20);
}

function pushCandidate(candidates, seen, item) {
  const key = itemKey(item.type, item.itemId);
  if (!item.itemId || seen.has(key)) return;
  seen.add(key);
  candidates.push({
    type: item.type,
    itemId: clean(item.itemId, 140),
    reference: clean(item.reference || item.itemId, 140),
    customer: clean(item.customer || 'Customer', 140),
    subject: clean(item.subject || item.summary || item.reference || item.itemId, 180),
    channel: clean(item.channel || 'Customer operations', 60),
    priority: ['critical', 'high', 'urgent', 'normal', 'low'].includes(item.priority) ? item.priority : 'normal',
    dueLabel: clean(item.dueLabel, 100),
    callbackIds: Array.isArray(item.callbackIds) ? item.callbackIds.slice(0, 20) : [],
    originalOwner: clean(item.originalOwner, 100),
    originalOwnerId: clean(item.originalOwnerId, 100),
    status: 'pending',
    staleReason: ''
  });
}

/**
 * Collect work that can safely change hands at an agent shift boundary.
 * Active voice/outbound call sessions are deliberately not included.
 */
export function collectAgentHandoverCandidates(resources = {}, outgoingAgent, outgoingAgentId, handovers = []) {
  const owner = clean(outgoingAgent, 100);
  const ownerId = clean(outgoingAgentId, 100);
  if (owner.length < 2 || ownerId.length < 3) return [];

  const candidates = [];
  const seen = new Set();
  const pending = pendingItemKeys(handovers);
  const commitments = Array.isArray(resources.commitments) ? resources.commitments : [];
  const cases = Array.isArray(resources.cases) ? resources.cases : [];
  const digitalQueue = Array.isArray(resources.digitalQueue) ? resources.digitalQueue : [];
  const callbacks = Array.isArray(resources.callbacks) ? resources.callbacks : [];

  for (const contact of digitalQueue) {
    if (!contact?.id || !ACTIVE_DIGITAL.has(contact.status) || clean(contact.assignedTo, 100) !== ownerId) continue;
    pushCandidate(candidates, seen, {
      type: 'digital_contact', itemId: contact.id, reference: contact.id,
      customer: contact.customer, subject: contact.subject,
      channel: contact.channelLabel || contact.channel,
      priority: contact.priority, originalOwner: owner, originalOwnerId: ownerId
    });
  }

  for (const commitment of commitments) {
    if (!commitment?.id || commitment.status !== 'Open' || !sameName(commitment.owner, owner)) continue;
    pushCandidate(candidates, seen, {
      type: 'customer_commitment', itemId: commitment.id,
      reference: commitment.caseId || commitment.contactReference || commitment.id,
      customer: commitment.customerName, subject: commitment.commitment,
      channel: commitment.preferredChannel || 'Callback', priority: 'high',
      dueLabel: `${commitment.dueDate || ''} ${String(commitment.dueMinutes ?? '')}`.trim(),
      callbackIds: linkedCallbacks(callbacks, { commitmentId: commitment.id }),
      originalOwner: owner
    });
  }

  const followUpReferences = new Set();
  for (const record of cases) {
    const followUp = record?.lifecycle?.followUp;
    if (!record?.reference || !followUp || !ACTIVE_FOLLOWUP.has(followUp.status)) continue;
    if (!sameName(followUp.owner, owner)) continue;
    if (followUp.claimedBy && !sameName(followUp.claimedBy, owner)) continue;
    const reference = clean(record.reference, 140);
    followUpReferences.add(reference);
    pushCandidate(candidates, seen, {
      type: 'case_followup', itemId: reference, reference,
      customer: record.customer, subject: followUp.reason || record.title,
      channel: record.channel || 'Case follow-up',
      priority: followUp.priority === 'urgent' ? 'urgent' : 'normal',
      dueLabel: `Day ${followUp.dueDay} · ${String(followUp.dueMinute ?? '')}`,
      callbackIds: linkedCallbacks(callbacks, { caseReference: reference }),
      originalOwner: owner
    });
  }

  for (const record of cases) {
    if (!record?.reference || !sameName(record.owner, owner) || !isOpenCase(record)) continue;
    if (record.lifecycle?.followUp?.status === 'supervisor_review') continue;
    const reference = clean(record.reference, 140);
    if (followUpReferences.has(reference)) continue;
    pushCandidate(candidates, seen, {
      type: 'open_case', itemId: reference, reference,
      customer: record.customer, subject: record.title,
      channel: record.channel || 'CRM case', priority: 'normal',
      callbackIds: linkedCallbacks(callbacks, { caseReference: reference }),
      originalOwner: owner
    });
  }

  const rank = { critical: 0, urgent: 1, high: 2, normal: 3, low: 4 };
  return candidates
    .filter(item => !pending.has(itemKey(item.type, item.itemId)))
    .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)
      || a.type.localeCompare(b.type)
      || a.reference.localeCompare(b.reference));
}

export function normalizeAgentHandovers(raw = [], now = new Date()) {
  const current = validDate(now);
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => item && typeof item === 'object' && clean(item.id, 140)).slice(-MAX_HANDOVERS).map(item => {
    const items = Array.isArray(item.items) ? item.items.slice(0, MAX_ITEMS).map(row => ({
      type: AGENT_HANDOVER_ITEM_TYPES.includes(row?.type) ? row.type : 'open_case',
      itemId: clean(row?.itemId || row?.reference, 140),
      reference: clean(row?.reference || row?.itemId, 140),
      customer: clean(row?.customer || 'Customer', 140),
      subject: clean(row?.subject, 180),
      channel: clean(row?.channel, 60),
      priority: ['critical', 'high', 'urgent', 'normal', 'low'].includes(row?.priority) ? row.priority : 'normal',
      dueLabel: clean(row?.dueLabel, 100),
      callbackIds: Array.isArray(row?.callbackIds) ? row.callbackIds.map(id => clean(id, 120)).filter(Boolean).slice(0, 20) : [],
      originalOwner: clean(row?.originalOwner || item.fromAgent, 100),
      originalOwnerId: clean(row?.originalOwnerId || item.fromAgentId, 100),
      status: ['pending', 'transferred', 'stale'].includes(row?.status) ? row.status : 'pending',
      staleReason: clean(row?.staleReason, 300),
      transferredAt: row?.transferredAt || null
    })).filter(row => row.itemId) : [];
    return {
      id: clean(item.id, 140),
      version: AGENT_HANDOVER_VERSION,
      fromAgent: clean(item.fromAgent, 100),
      fromAgentId: clean(item.fromAgentId, 100),
      toAgent: clean(item.toAgent, 100),
      toAgentId: clean(item.toAgentId, 100),
      note: clean(item.note, 1200),
      status: ['pending_acceptance', 'accepted', 'cancelled'].includes(item.status) ? item.status : 'pending_acceptance',
      createdAt: validDate(item.createdAt, current.getTime()).toISOString(),
      acceptedAt: item.acceptedAt || null,
      acceptedBy: clean(item.acceptedBy, 100),
      cancelledAt: item.cancelledAt || null,
      cancelledBy: clean(item.cancelledBy, 100),
      cancellationReason: clean(item.cancellationReason, 400),
      items
    };
  });
}

export function createAgentShiftHandover(resources, existing = [], input = {}, now = new Date()) {
  if (!resources || typeof resources !== 'object') throw new TypeError('Agent work resources are required.');
  if (!Array.isArray(existing)) throw new TypeError('Agent handover history must be an array.');
  const fromAgent = clean(input.fromAgent, 100);
  const fromAgentId = clean(input.fromAgentId, 100);
  const toAgent = clean(input.toAgent, 100);
  const toAgentId = clean(input.toAgentId, 100);
  const note = clean(input.note, 1200);
  if (fromAgent.length < 2 || fromAgentId.length < 3) throw new Error('A named outgoing agent and employee reference are required.');
  if (toAgent.length < 2 || toAgentId.length < 3) throw new Error('A named incoming agent and employee reference are required.');
  if (sameName(fromAgent, toAgent) || fromAgentId === toAgentId) throw new Error('The incoming agent must be different from the outgoing agent.');
  if (note.length < 30) throw new Error('Record at least 30 characters covering customer risk, actions taken and the next required step.');

  const candidates = collectAgentHandoverCandidates(resources, fromAgent, fromAgentId, existing);
  if (!candidates.length) throw new Error('There is no eligible open work currently owned by this agent.');
  const at = validDate(now).toISOString();
  const sequence = existing.length + 1;
  const handover = {
    id: `AGH-${validDate(now).getTime().toString(36).toUpperCase()}-${sequence.toString(36).toUpperCase().padStart(3, '0')}`,
    version: AGENT_HANDOVER_VERSION,
    fromAgent,
    fromAgentId,
    toAgent,
    toAgentId,
    note,
    status: 'pending_acceptance',
    createdAt: at,
    acceptedAt: null,
    acceptedBy: '',
    cancelledAt: null,
    cancelledBy: '',
    cancellationReason: '',
    items: candidates.map(item => ({ ...item, status: 'pending', staleReason: '', transferredAt: null }))
  };
  existing.push(handover);
  if (existing.length > MAX_HANDOVERS) existing.splice(0, existing.length - MAX_HANDOVERS);
  return handover;
}

function appendDigitalTimeline(contact, event) {
  contact.timeline = Array.isArray(contact.timeline) ? contact.timeline : [];
  contact.timeline.unshift(event);
  contact.timeline = contact.timeline.slice(0, 80);
}

function appendCaseHistory(record, event) {
  record.lifecycle = record.lifecycle && typeof record.lifecycle === 'object' ? record.lifecycle : {};
  record.lifecycle.history = Array.isArray(record.lifecycle.history) ? record.lifecycle.history : [];
  record.lifecycle.history.unshift(event);
  record.lifecycle.history = record.lifecycle.history.slice(0, MAX_HISTORY);
}

function appendFollowUpHistory(followUp, event) {
  followUp.history = Array.isArray(followUp.history) ? followUp.history : [];
  followUp.history.unshift(event);
  followUp.history = followUp.history.slice(0, MAX_HISTORY);
}

function stale(item, reason) {
  item.status = 'stale';
  item.staleReason = clean(reason, 300);
  return false;
}

function transferItem(resources, handover, item, at) {
  const fromAgent = handover.fromAgent;
  const toAgent = handover.toAgent;
  const actor = handover.toAgent;

  if (item.type === 'digital_contact') {
    const contact = (resources.digitalQueue || []).find(row => row?.id === item.itemId);
    if (!contact || !ACTIVE_DIGITAL.has(contact.status) || clean(contact.assignedTo, 100) !== handover.fromAgentId) {
      return stale(item, 'Digital contact was completed, removed or reassigned before acceptance.');
    }
    contact.assignedTo = handover.toAgentId;
    contact.assignedAgentName = toAgent;
    appendDigitalTimeline(contact, { at, event: `Agent shift handover accepted by ${actor}; work reassigned from ${fromAgent}.`, status: contact.status, details: { handoverId: handover.id, fromAgentId: handover.fromAgentId, toAgentId: handover.toAgentId } });
    item.status = 'transferred';
    item.transferredAt = at;
    return true;
  }

  if (item.type === 'customer_commitment') {
    const commitment = (resources.commitments || []).find(row => row?.id === item.itemId);
    if (!commitment || commitment.status !== 'Open' || !sameName(commitment.owner, fromAgent)) {
      return stale(item, 'Customer commitment was completed, moved to review or reassigned before acceptance.');
    }
    commitment.owner = toAgent;
    commitment.history = Array.isArray(commitment.history) ? commitment.history : [];
    commitment.history.unshift({ at, outcome: 'agent-shift-handover', summary: `Ownership transferred from ${fromAgent} to ${toAgent}. Handover ${handover.id}.`, fromOwner: fromAgent, toOwner: toAgent, handoverId: handover.id });
    commitment.history = commitment.history.slice(0, 20);
    if (resources.commitmentState && Array.isArray(resources.commitmentState.activity)) {
      resources.commitmentState.activity.unshift({ at, message: `Customer commitment ${commitment.id} transferred to ${toAgent} in handover ${handover.id}.` });
      resources.commitmentState.activity = resources.commitmentState.activity.slice(0, 200);
    }
    item.status = 'transferred';
    item.transferredAt = at;
    return true;
  }

  const record = (resources.cases || []).find(row => clean(row?.reference, 140) === item.itemId);
  if (!record || !isOpenCase(record)) {
    return stale(item, 'CRM case was closed or removed before acceptance.');
  }

  if (item.type === 'case_followup') {
    const followUp = record.lifecycle?.followUp;
    if (!ACTIVE_FOLLOWUP.has(followUp?.status) || !sameName(followUp.owner, fromAgent)
      || (followUp.claimedBy && !sameName(followUp.claimedBy, fromAgent))) {
      return stale(item, 'Case follow-up is no longer open under the outgoing agent.');
    }
    record.owner = toAgent;
    followUp.owner = toAgent;
    // The incoming employee must explicitly claim the work; do not inherit an old active claim.
    followUp.status = 'open';
    followUp.claimedBy = '';
    followUp.claimedAt = null;
    followUp.updatedAt = at;
    appendFollowUpHistory(followUp, { at, action: 'agent_shift_handover', actor, from: fromAgent, to: toAgent, handoverId: handover.id, summary: 'Follow-up transferred; incoming agent must claim before action.' });
    appendCaseHistory(record, { at, action: 'follow_up_handover', actor, from: fromAgent, to: toAgent, handoverId: handover.id });
  } else {
    if (!sameName(record.owner, fromAgent)) {
      return stale(item, 'CRM case was reassigned before acceptance.');
    }
    record.owner = toAgent;
    appendCaseHistory(record, { at, action: 'case_handover', actor, from: fromAgent, to: toAgent, handoverId: handover.id });
  }
  item.status = 'transferred';
  item.transferredAt = at;
  return true;
}

export function acceptAgentShiftHandover(resources, handovers, handoverId, actor, actorId, now = new Date()) {
  if (!resources || typeof resources !== 'object') throw new TypeError('Agent work resources are required.');
  if (!Array.isArray(handovers)) throw new TypeError('Agent handover history must be an array.');
  const index = handovers.findIndex(item => item?.id === handoverId);
  if (index < 0) throw new Error('This agent handover is no longer awaiting acceptance.');
  const normalised = normalizeAgentHandovers([handovers[index]], now)[0];
  Object.assign(handovers[index], normalised);
  const handover = handovers[index];
  if (handover.status !== 'pending_acceptance') throw new Error('This agent handover is no longer awaiting acceptance.');
  const recipient = clean(actor, 100);
  const recipientId = clean(actorId, 100);
  if (!sameName(recipient, handover.toAgent) || recipientId !== handover.toAgentId) {
    throw new Error(`Only the named incoming agent ${handover.toAgent} can accept this handover in the local simulation.`);
  }
  const at = validDate(now).toISOString();
  let transferred = 0;
  let staleCount = 0;
  for (const item of handover.items) {
    if (item.status !== 'pending') continue;
    if (transferItem(resources, handover, item, at)) transferred += 1;
    else staleCount += 1;
  }
  handover.status = 'accepted';
  handover.acceptedAt = at;
  handover.acceptedBy = recipient;
  return { handover, transferred, stale: staleCount, acceptedBy: recipient };
}

export function cancelAgentShiftHandover(handovers, handoverId, actor, reason, now = new Date()) {
  if (!Array.isArray(handovers)) throw new TypeError('Agent handover history must be an array.');
  const index = handovers.findIndex(item => item?.id === handoverId);
  if (index < 0) throw new Error('Only a pending agent handover can be cancelled.');
  const normalised = normalizeAgentHandovers([handovers[index]], now)[0];
  Object.assign(handovers[index], normalised);
  const handover = handovers[index];
  if (handover.status !== 'pending_acceptance') throw new Error('Only a pending agent handover can be cancelled.');
  const outgoing = clean(actor, 100);
  if (!sameName(outgoing, handover.fromAgent)) throw new Error('Only the outgoing agent can cancel this pending handover.');
  const explanation = clean(reason, 400);
  if (explanation.length < 10) throw new Error('Explain the cancellation in at least 10 characters.');
  const at = validDate(now).toISOString();
  handover.status = 'cancelled';
  handover.cancelledAt = at;
  handover.cancelledBy = outgoing;
  handover.cancellationReason = explanation;
  for (const item of handover.items) if (item.status === 'pending') item.status = 'stale';
  return handover;
}

export function agentShiftHandoverMetrics(handovers = []) {
  const rows = Array.isArray(handovers) ? handovers : [];
  const pending = rows.filter(item => item.status === 'pending_acceptance');
  const allItems = rows.flatMap(item => Array.isArray(item.items) ? item.items : []);
  return {
    total: rows.length,
    pending: pending.length,
    accepted: rows.filter(item => item.status === 'accepted').length,
    cancelled: rows.filter(item => item.status === 'cancelled').length,
    pendingItems: allItems.filter(item => item.status === 'pending').length,
    transferredItems: allItems.filter(item => item.status === 'transferred').length,
    staleItems: allItems.filter(item => item.status === 'stale').length
  };
}
