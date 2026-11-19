const VALID_STATUSES = new Set(['not_started', 'in_progress', 'submitted', 'failed']);
const VALID_PHASES = new Set(['aptitude', 'practical', 'review']);

function isAnswered(value, optionCount) {
  return Number.isInteger(value) && value >= 0 && (optionCount == null || value < optionCount);
}

function countAnswers(answers, count, optionCounts) {
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const optionCount = Array.isArray(optionCounts) ? optionCounts[index] : undefined;
    if (isAnswered(answers[index], optionCount)) total += 1;
  }
  return total;
}

/** Recover a safe draft status from both current saves and older CALLORIA saves. */
export function normaliseAssessmentDraftStatus(status, state = {}) {
  if (state.stage === 'assessment') return 'in_progress';
  if (state.stage === 'failed') return 'failed';
  if (state.stage === 'offer' || state.stage === 'employee') return 'submitted';

  const aptitude = Array.isArray(state.assessmentAnswers) ? state.assessmentAnswers : [];
  const practical = Array.isArray(state.practicalAnswers) ? state.practicalAnswers : [];
  const hasResponses = [...aptitude, ...practical].some(value => Number.isInteger(value) && value >= 0);
  if (status === 'not_started' && hasResponses && state.applicationSubmitted) return 'in_progress';
  if (VALID_STATUSES.has(status)) return status;
  return hasResponses && state.applicationSubmitted ? 'in_progress' : 'not_started';
}

/** Return a display-safe summary without changing the saved assessment answers. */
export function assessmentDraftSummary(state = {}, counts = {}) {
  const aptitudeCount = Math.max(0, Number(counts.aptitudeCount) || 0);
  const practicalCount = Math.max(0, Number(counts.practicalCount) || 0);
  const aptitudeAnswers = Array.isArray(state.assessmentAnswers) ? state.assessmentAnswers : [];
  const practicalAnswers = Array.isArray(state.practicalAnswers) ? state.practicalAnswers : [];
  const aptitudeAnswered = countAnswers(aptitudeAnswers, aptitudeCount, counts.aptitudeOptionCounts);
  const practicalAnswered = countAnswers(practicalAnswers, practicalCount, counts.practicalOptionCounts);
  const totalCount = aptitudeCount + practicalCount;
  const answeredCount = aptitudeAnswered + practicalAnswered;
  const status = normaliseAssessmentDraftStatus(state.assessmentStatus, state);
  return {
    status,
    aptitudeAnswered,
    aptitudeCount,
    practicalAnswered,
    practicalCount,
    answeredCount,
    totalCount,
    remainingCount: Math.max(0, totalCount - answeredCount),
    progressPercent: totalCount ? Math.round(answeredCount / totalCount * 100) : 0,
    complete: totalCount > 0 && answeredCount === totalCount,
    hasProgress: answeredCount > 0 || status === 'in_progress',
    savedAt: typeof state.assessmentSavedAt === 'string' ? state.assessmentSavedAt : null,
    phase: VALID_PHASES.has(state.assessmentPhase) ? state.assessmentPhase : 'aptitude'
  };
}

/** Start a clean attempt or resume an existing in-progress attempt. */
export function startAssessmentDraft(state, options = {}) {
  const now = typeof options.now === 'string' ? options.now : new Date().toISOString();
  const reset = options.reset === true;
  const resumed = !reset && normaliseAssessmentDraftStatus(state.assessmentStatus, state) === 'in_progress';
  const aptitudeCount = Math.max(0, Number(options.aptitudeCount) || 0);
  const practicalCount = Math.max(0, Number(options.practicalCount) || 0);

  state.stage = 'assessment';
  if (!resumed) {
    state.assessmentPhase = 'aptitude';
    state.assessmentIndex = 0;
    state.assessmentAnswers = [];
    state.practicalIndex = 0;
    state.practicalAnswers = [];
    state.assessmentReturnToReview = false;
    state.assessmentStartedAt = now;
    state.assessmentSubmittedAt = null;
    state.assessmentStatus = 'in_progress';
    state.assessmentSavedAt = now;
  } else {
    state.assessmentAnswers = Array.isArray(state.assessmentAnswers) ? state.assessmentAnswers.slice(0, aptitudeCount) : [];
    state.practicalAnswers = Array.isArray(state.practicalAnswers) ? state.practicalAnswers.slice(0, practicalCount) : [];
    if (!VALID_PHASES.has(state.assessmentPhase)) state.assessmentPhase = 'aptitude';
    state.assessmentIndex = Number.isInteger(state.assessmentIndex)
      ? Math.max(0, Math.min(Math.max(0, aptitudeCount - 1), state.assessmentIndex)) : 0;
    state.practicalIndex = Number.isInteger(state.practicalIndex)
      ? Math.max(0, Math.min(Math.max(0, practicalCount - 1), state.practicalIndex)) : 0;
    state.assessmentReturnToReview = state.assessmentReturnToReview === true;
    state.assessmentStatus = 'in_progress';
    if (typeof state.assessmentStartedAt !== 'string') state.assessmentStartedAt = state.assessmentSavedAt || now;
  }
  return { resumed, summary: assessmentDraftSummary(state, options) };
}

/** Save an in-progress attempt and return to the candidate hub without losing answers. */
export function suspendAssessmentDraft(state, now = new Date().toISOString()) {
  if (!state || state.stage !== 'assessment') return false;
  state.stage = 'applicant';
  state.assessmentStatus = 'in_progress';
  state.assessmentSavedAt = now;
  return true;
}

export function markAssessmentSubmitted(state, now = new Date().toISOString()) {
  state.assessmentStatus = 'submitted';
  state.assessmentSubmittedAt = now;
  state.assessmentSavedAt = now;
  state.assessmentReturnToReview = false;
  return state;
}

export function markAssessmentOutcome(state, passed) {
  state.assessmentStatus = passed ? 'submitted' : 'failed';
  return state;
}
