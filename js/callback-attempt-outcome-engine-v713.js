/**
 * CALLORIA v7.13 — callback attempt outcome integrity.
 * Synthetic local gameplay records only; this module does not dial customers.
 */
export const CALLBACK_ATTEMPT_OUTCOMES_V713 = Object.freeze([
  'contact_reached',
  'no_answer',
  'busy',
  'voicemail',
  'cancelled_before_contact',
  'interrupted_after_connection',
  'returned_to_queue'
]);

const OUTCOME_SET = new Set(CALLBACK_ATTEMPT_OUTCOMES_V713);
const MAX_ATTEMPT_HISTORY = 12;

function safeTimestamp(value) {
  const numeric = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(numeric)) throw new TypeError('A valid callback attempt timestamp is required.');
  return new Date(numeric).toISOString();
}

function safeText(value, maximum = 180) {
  return String(value ?? '')
    .replace(/[<>\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

/**
 * Finalise only an in-progress callback task.
 * `contact_reached` is the only outcome that closes a callback as completed.
 * A callback returned to the inbound queue remains active and queued.
 * Non-contact outcomes remain visible as attempt_failed for reconciliation.
 */
export function recordCallbackAttemptOutcome(callbacks, {
  callbackId = null,
  contactId = null,
  outcome = 'contact_reached',
  reason = ''
} = {}, now = Date.now()) {
  const list = Array.isArray(callbacks) ? callbacks : [];
  const selectedId = safeText(callbackId, 120);
  const selectedContactId = safeText(contactId, 120);
  if (!OUTCOME_SET.has(outcome)) throw new RangeError('Unsupported callback attempt outcome.');
  if (!selectedId && !selectedContactId) throw new TypeError('A callback ID or contact ID is required.');
  const at = safeTimestamp(now);
  const callback = list.find(item => item && item.status === 'in_progress' && (
    selectedId ? item.id === selectedId : item.contactId === selectedContactId
  ));
  if (!callback) return { changed: false, callback: null, reason: 'no_in_progress_callback' };

  const previousStatus = callback.status;
  const history = Array.isArray(callback.attemptHistory) ? callback.attemptHistory : [];
  const startedAt = typeof callback.attemptedAt === 'string' ? callback.attemptedAt : null;
  const resultingStatus = outcome === 'contact_reached'
    ? 'completed'
    : outcome === 'returned_to_queue'
      ? 'queued'
      : 'attempt_failed';

  history.push({
    attemptId: safeText(callback.attemptId || callback.attemptedAt || callback.id, 120),
    startedAt,
    endedAt: at,
    outcome,
    previousStatus,
    resultingStatus,
    reason: safeText(reason, 180)
  });
  callback.attemptHistory = history.slice(-MAX_ATTEMPT_HISTORY);
  callback.status = resultingStatus;
  callback.lastAttemptOutcome = outcome;
  callback.attemptEndedAt = at;
  callback.attemptResultReason = safeText(reason, 180);

  if (outcome === 'contact_reached') {
    callback.completedAt = at;
    callback.failedAt = null;
  } else if (outcome === 'returned_to_queue') {
    callback.queuedAt = at;
    callback.completedAt = null;
    callback.failedAt = null;
  } else {
    callback.failedAt = at;
    callback.completedAt = null;
  }
  return { changed: true, callback, outcome, resultingStatus, at };
}

/** Align an outbound campaign callback task with its formal promise timestamp. */
export function alignCampaignCallbackDueAt(callback, workItem) {
  if (!callback || !workItem || !callback.dueAt) return false;
  const dueAt = Date.parse(callback.dueAt);
  if (!Number.isFinite(dueAt)) return false;
  const normalized = new Date(dueAt).toISOString();
  const changed = workItem.callbackDueAt !== normalized;
  workItem.callbackDueAt = normalized;
  workItem.nextEligibleAt = null;
  workItem.status = 'callback_scheduled';
  return changed;
}
