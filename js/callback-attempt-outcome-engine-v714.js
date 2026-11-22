/**
 * CALLORIA v7.14 — callback attempt outcome and due-time integrity.
 * Operates only on synthetic local gameplay records. It never places calls.
 */
export const CALLBACK_OUTCOMES_V714 = Object.freeze([
  'contact_reached',
  'no_answer',
  'busy',
  'voicemail',
  'cancelled_before_contact',
  'interrupted_after_connection',
  'returned_to_queue'
]);

const OUTCOMES = new Set(CALLBACK_OUTCOMES_V714);
const MAX_HISTORY = 12;

function timestamp(value) {
  const ms = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(ms)) throw new TypeError('A valid callback attempt timestamp is required.');
  return new Date(ms).toISOString();
}

function safeText(value, limit = 180) {
  return String(value ?? '')
    .replace(/[<>\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

/**
 * Finalises an in-progress callback attempt exactly once.
 * Only a reached customer produces `completed`; other outcomes remain visible
 * as failed/queued attempt evidence and do not fulfil the customer promise.
 */
export function recordCallbackAttemptOutcomeV714(callbacks, {
  callbackId = null,
  contactId = null,
  outcome = 'contact_reached',
  reason = ''
} = {}, now = Date.now()) {
  const list = Array.isArray(callbacks) ? callbacks : [];
  const id = safeText(callbackId, 120);
  const contact = safeText(contactId, 120);
  if (!OUTCOMES.has(outcome)) throw new RangeError('Unsupported callback attempt outcome.');
  if (!id && !contact) throw new TypeError('A callback ID or contact ID is required.');
  const at = timestamp(now);
  const row = list.find(item => item && item.status === 'in_progress' && (
    id ? item.id === id : item.contactId === contact
  ));
  if (!row) return { changed: false, callback: null, reason: 'no_in_progress_callback' };

  const history = Array.isArray(row.attemptHistory) ? row.attemptHistory : [];
  const resultingStatus = outcome === 'contact_reached'
    ? 'completed'
    : outcome === 'returned_to_queue'
      ? 'queued'
      : 'attempt_failed';
  history.push({
    attemptId: safeText(row.attemptId || row.attemptedAt || row.id, 120),
    startedAt: typeof row.attemptedAt === 'string' ? row.attemptedAt : null,
    endedAt: at,
    outcome,
    resultingStatus,
    reason: safeText(reason, 180)
  });
  row.attemptHistory = history.slice(-MAX_HISTORY);
  row.status = resultingStatus;
  row.lastAttemptOutcome = outcome;
  row.attemptEndedAt = at;
  row.attemptResultReason = safeText(reason, 180);
  row.completedAt = outcome === 'contact_reached' ? at : null;
  row.failedAt = resultingStatus === 'attempt_failed' ? at : null;
  row.queuedAt = outcome === 'returned_to_queue' ? at : row.queuedAt || null;
  return { changed: true, callback: row, outcome, resultingStatus, at };
}

/** Keep the campaign worklist timestamp identical to the commitment callback. */
export function alignCallbackWorkItemToPromise(callback, workItem) {
  if (!callback || !workItem) return { changed: false, reason: 'missing_record' };
  const due = Date.parse(callback.dueAt || '');
  if (!Number.isFinite(due)) return { changed: false, reason: 'invalid_promise_due_at' };
  const normalized = new Date(due).toISOString();
  const changed = workItem.status !== 'callback_scheduled'
    || workItem.callbackDueAt !== normalized
    || workItem.nextEligibleAt !== null;
  workItem.status = 'callback_scheduled';
  workItem.callbackDueAt = normalized;
  workItem.nextEligibleAt = null;
  return { changed, dueAt: normalized };
}
