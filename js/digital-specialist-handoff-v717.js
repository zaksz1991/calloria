/**
 * CALLORIA v7.17 — Digital specialist handoff data contracts.
 * Pure helpers for the local synthetic simulator. No live provider or CRM calls.
 */
export const DIGITAL_SPECIALIST_HANDOFF_VERSION = '7.17.0';

export const DIGITAL_SPECIALIST_DEPARTMENTS = Object.freeze([
  'Cards & Payments',
  'Transfers Support',
  'Fraud & Payments',
  'Digital Support',
  'Customer Experience',
  'IT Systems Support',
  'RuffNeck Product Support',
  'Life & Advice',
  'Complaints & Resolution'
]);

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function validTimestamp(value) {
  const date = value instanceof Date ? value : new Date(Number(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function safePriority(value) {
  return ['critical', 'high', 'normal'].includes(String(value || '').toLowerCase())
    ? String(value).toLowerCase()
    : 'normal';
}

export function validateDigitalSpecialistHandoff(input = {}) {
  const department = cleanText(input.department, 80);
  const reason = cleanText(input.reason, 500);
  if (!DIGITAL_SPECIALIST_DEPARTMENTS.includes(department)) {
    return { ok: false, error: 'Choose a valid specialist destination.' };
  }
  if (reason.length < 12) {
    return { ok: false, error: 'Explain why specialist support is required in at least 12 characters.' };
  }
  if (reason.length > 240) {
    return { ok: false, error: 'The escalation reason must be 240 characters or fewer.' };
  }
  return { ok: true, value: Object.freeze({ department, reason }) };
}

/**
 * Create an auditable request for the existing Supervisor Escalations queue.
 * The request deliberately has no `caseReference` property: that property
 * triggers a different legacy card action. `linkedCaseReference` links the
 * CRM case without bypassing the normal supervisor claim/review workflow.
 */
export function createDigitalSpecialistHandoffRequest({
  id,
  contact,
  caseReference,
  department,
  reason,
  actor = 'Agent',
  now = Date.now()
} = {}) {
  const validation = validateDigitalSpecialistHandoff({ department, reason });
  if (!validation.ok) throw new TypeError(validation.error);
  if (!contact || typeof contact !== 'object' || !contact.id) {
    throw new TypeError('A linked digital contact is required for specialist handoff.');
  }
  const safeId = cleanText(id, 120);
  const safeReference = cleanText(caseReference, 120);
  const requestedBy = cleanText(actor, 100) || 'Agent';
  if (!safeId || !safeReference) throw new TypeError('A request ID and CRM case reference are required.');
  const requestedAt = validTimestamp(now);
  const destination = validation.value.department;
  const explanation = validation.value.reason;
  const requestReason = `Digital specialist handoff requested for ${destination}: ${explanation}`.slice(0, 600);
  return {
    id: safeId,
    contactId: cleanText(contact.id, 120),
    reference: safeReference,
    linkedCaseReference: safeReference,
    customer: cleanText(contact.customer || 'Synthetic customer', 120),
    reason: requestReason,
    status: 'open',
    createdAt: requestedAt,
    channel: `${cleanText(contact.channelLabel || contact.channel || 'Digital', 60)} · Digital specialist handoff`,
    priority: safePriority(contact.priority),
    source: 'digital-specialist-handoff-v717',
    specialistDepartment: destination,
    handoff: {
      version: DIGITAL_SPECIALIST_HANDOFF_VERSION,
      destination,
      reason: explanation,
      requestedBy,
      requestedAt,
      stage: 'awaiting_supervisor_review',
      history: [{ at: requestedAt, action: 'requested', actor: requestedBy, destination }]
    }
  };
}

/** Attach/update a requested destination on an already-open supervisor request. */
export function attachDigitalSpecialistHandoff(request, draft) {
  if (!request || typeof request !== 'object' || !draft || typeof draft !== 'object') {
    throw new TypeError('An open supervisor request and a handoff draft are required.');
  }
  const priorHistory = Array.isArray(request.handoff?.history) ? request.handoff.history.slice(-19) : [];
  const requestReason = cleanText(request.reason, 360);
  const addition = `Specialist destination requested: ${draft.specialistDepartment}. ${draft.handoff.reason}`;
  return {
    ...request,
    reason: `${requestReason}${requestReason ? ' · ' : ''}${addition}`.slice(0, 600),
    specialistDepartment: draft.specialistDepartment,
    linkedCaseReference: draft.linkedCaseReference,
    source: request.source || 'digital-customer-intervention-with-specialist-handoff-v717',
    handoff: {
      ...draft.handoff,
      history: [...priorHistory, ...draft.handoff.history].slice(-20)
    }
  };
}
