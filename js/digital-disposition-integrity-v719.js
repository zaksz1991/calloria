/**
 * CALLORIA v7.19 — digital disposition evidence gate.
 * Pure validation for the local synthetic digital-support simulator.
 * It never contacts a real inbox or changes the QA scoring engine.
 */

const OPEN_DIGITAL_STATUSES = new Set(['active', 'awaiting_customer']);
const SUPERVISOR_REVIEWED_STATES = new Set(['reviewed', 'resolved', 'closed', 'completed']);

const EVIDENCE_LABELS = Object.freeze({
  customer_confirmed: 'Customer confirmation recorded',
  one_touch_resolution: 'One-touch guidance / resolution recorded',
  customer_information_pending: 'Customer information or confirmation requested',
  specialist_referral_created: 'Specialist referral recorded'
});

function cleanText(value, max = 1200) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function hasCustomerReplyAfterAgent(contact) {
  const messages = Array.isArray(contact?.messages) ? contact.messages : [];
  let agentHasReplied = false;
  for (const message of messages) {
    if (message?.type === 'agent') agentHasReplied = true;
    else if (message?.type === 'customer' && agentHasReplied) return true;
  }
  return false;
}

/**
 * Validate an agent-selected disposition against the interaction evidence.
 * `supervisorRequestOpen` and `supervisorReviewRecorded` must be derived from
 * the existing local supervisor request ledger by the caller.
 */
export function validateDigitalDispositionEvidence({
  contact,
  disposition,
  evidenceType,
  notes,
  supervisorRequestOpen = false,
  supervisorReviewRecorded = false
} = {}) {
  const safeNotes = cleanText(notes, 1200);
  const fail = reason => ({ allowed: false, reason, evidenceType: '', label: '' });

  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return fail('The digital interaction could not be found.');
  }
  if (!OPEN_DIGITAL_STATUSES.has(contact.status)) {
    return fail('Only an active digital interaction can receive a final disposition.');
  }
  if (!['resolved', 'pending_customer', 'escalated'].includes(disposition)) {
    return fail('Choose a valid digital-contact disposition.');
  }
  if (safeNotes.length < 20) {
    return fail('Record at least 20 characters of factual case notes before closing this interaction.');
  }
  if (!EVIDENCE_LABELS[evidenceType]) {
    return fail('Select the evidence that supports the chosen disposition.');
  }

  if (disposition === 'resolved') {
    if (!['customer_confirmed', 'one_touch_resolution'].includes(evidenceType)) {
      return fail('A resolved case requires customer confirmation or a documented one-touch resolution.');
    }
    if (contact.customerBehaviour?.needsSupervisor === true && !supervisorReviewRecorded) {
      return fail('This customer interaction has an unresolved supervisor-risk flag. Record the supervisor review or use a pending / escalated disposition.');
    }
    if (evidenceType === 'customer_confirmed' && !hasCustomerReplyAfterAgent(contact)) {
      return fail('Customer confirmation cannot be recorded until the customer has replied after an agent response.');
    }
    if (evidenceType === 'one_touch_resolution') {
      const pending = Boolean(contact.customerBehaviour?.pendingResponse);
      if (pending) return fail('The customer still has a scripted response pending. Receive and handle it, or use Pending customer.');
      if (contact.customerBehaviour?.needsSupervisor === true) {
        return fail('One-touch resolution is not available while supervisor intervention is recommended.');
      }
      if (!(Number(contact.replyCount) > 0)) return fail('A one-touch resolution requires at least one recorded agent reply.');
    }
  }

  if (disposition === 'pending_customer' && evidenceType !== 'customer_information_pending') {
    return fail('Pending customer requires evidence that information or confirmation was requested from the customer.');
  }

  if (disposition === 'escalated') {
    if (evidenceType !== 'specialist_referral_created') {
      return fail('An escalated case requires a recorded specialist referral.');
    }
    if (!supervisorRequestOpen && !supervisorReviewRecorded) {
      return fail('Create or record the supervisor / specialist handoff before escalating this interaction.');
    }
  }

  return {
    allowed: true,
    reason: '',
    evidenceType,
    label: EVIDENCE_LABELS[evidenceType],
    notesLength: safeNotes.length,
    customerReplyObserved: hasCustomerReplyAfterAgent(contact)
  };
}

export const DIGITAL_DISPOSITION_EVIDENCE_OPTIONS = Object.freeze([
  Object.freeze({ value: 'customer_confirmed', label: EVIDENCE_LABELS.customer_confirmed, disposition: 'resolved' }),
  Object.freeze({ value: 'one_touch_resolution', label: EVIDENCE_LABELS.one_touch_resolution, disposition: 'resolved' }),
  Object.freeze({ value: 'customer_information_pending', label: EVIDENCE_LABELS.customer_information_pending, disposition: 'pending_customer' }),
  Object.freeze({ value: 'specialist_referral_created', label: EVIDENCE_LABELS.specialist_referral_created, disposition: 'escalated' })
]);
