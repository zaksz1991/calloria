const PHASES = new Set(['aptitude', 'practical', 'review']);

function validIndex(value, length) {
  return Number.isInteger(value) && value >= 0 && value < length;
}

function validAnswer(value, options) {
  return Number.isInteger(value) && value >= 0 && value < (Array.isArray(options) ? options.length : 0);
}

function normaliseProgress(progress = {}, counts = {}) {
  const aptitudeCount = Math.max(0, Number(counts.aptitudeCount) || 0);
  const practicalCount = Math.max(0, Number(counts.practicalCount) || 0);
  const aptitudeAnswers = Array.isArray(progress.aptitudeAnswers) ? progress.aptitudeAnswers.slice(0, aptitudeCount) : [];
  const practicalAnswers = Array.isArray(progress.practicalAnswers) ? progress.practicalAnswers.slice(0, practicalCount) : [];
  while (aptitudeAnswers.length < aptitudeCount) aptitudeAnswers.push(undefined);
  while (practicalAnswers.length < practicalCount) practicalAnswers.push(undefined);
  const aptitudeIndex = Math.max(0, Math.min(aptitudeCount - 1, Number.isInteger(progress.aptitudeIndex) ? progress.aptitudeIndex : 0));
  const practicalIndex = Math.max(0, Math.min(practicalCount - 1, Number.isInteger(progress.practicalIndex) ? progress.practicalIndex : 0));
  const phase = PHASES.has(progress.phase) ? progress.phase : 'aptitude';
  return { phase, aptitudeIndex: Math.max(0, aptitudeIndex), practicalIndex: Math.max(0, practicalIndex), aptitudeAnswers, practicalAnswers, returnToReview: progress.returnToReview === true };
}

/** Move forward only after the current question has a valid selected answer. */
export function nextAssessmentStep(progress, counts) {
  const current = normaliseProgress(progress, counts);
  const aptitudeCount = Math.max(0, Number(counts?.aptitudeCount) || 0);
  const practicalCount = Math.max(0, Number(counts?.practicalCount) || 0);
  if (current.phase === 'review') return { ok: false, reason: 'review-submit-required', progress: current };

  if (current.phase === 'aptitude') {
    const questionIndex = current.aptitudeIndex;
    // The renderer writes only existing answer-button indexes. The review model
    // performs the stricter option-count check before the final submission gate.
    if (!validIndex(questionIndex, aptitudeCount) || !Number.isInteger(current.aptitudeAnswers[questionIndex]) || current.aptitudeAnswers[questionIndex] < 0) {
      return { ok: false, reason: 'answer-required', progress: current };
    }
    if (current.returnToReview) return { ok: true, progress: { ...current, phase: 'review', returnToReview: false } };
    if (questionIndex + 1 < aptitudeCount) return { ok: true, progress: { ...current, aptitudeIndex: questionIndex + 1 } };
    return { ok: true, progress: { ...current, phase: practicalCount ? 'practical' : 'review', practicalIndex: 0 } };
  }

  const stepIndex = current.practicalIndex;
  if (!validIndex(stepIndex, practicalCount) || !Number.isInteger(current.practicalAnswers[stepIndex]) || current.practicalAnswers[stepIndex] < 0) {
    return { ok: false, reason: 'answer-required', progress: current };
  }
  if (current.returnToReview) return { ok: true, progress: { ...current, phase: 'review', returnToReview: false } };
  if (stepIndex + 1 < practicalCount) return { ok: true, progress: { ...current, practicalIndex: stepIndex + 1 } };
  return { ok: true, progress: { ...current, phase: 'review', returnToReview: false } };
}

/** Back navigates through aptitude -> practical -> review without discarding answers. */
export function previousAssessmentStep(progress, counts) {
  const current = normaliseProgress(progress, counts);
  const aptitudeCount = Math.max(0, Number(counts?.aptitudeCount) || 0);
  const practicalCount = Math.max(0, Number(counts?.practicalCount) || 0);
  if (current.returnToReview) return { ok: true, progress: { ...current, phase: 'review', returnToReview: false } };
  if (current.phase === 'review') {
    return practicalCount
      ? { ok: true, progress: { ...current, phase: 'practical', practicalIndex: practicalCount - 1 } }
      : { ok: true, progress: { ...current, phase: 'aptitude', aptitudeIndex: aptitudeCount - 1 } };
  }
  if (current.phase === 'practical') {
    if (current.practicalIndex > 0) return { ok: true, progress: { ...current, practicalIndex: current.practicalIndex - 1 } };
    return aptitudeCount
      ? { ok: true, progress: { ...current, phase: 'aptitude', aptitudeIndex: aptitudeCount - 1 } }
      : { ok: false, reason: 'first-step', progress: current };
  }
  if (current.aptitudeIndex > 0) return { ok: true, progress: { ...current, aptitudeIndex: current.aptitudeIndex - 1 } };
  return { ok: false, reason: 'first-step', progress: current };
}

/** Jump from the review page to one recorded response, returning to review on save. */
export function jumpToAssessmentResponse(progress, target, counts) {
  const current = normaliseProgress(progress, counts);
  if (!target || !['aptitude', 'practical'].includes(target.section) || !Number.isInteger(target.index)) {
    return { ok: false, reason: 'invalid-target', progress: current };
  }
  const maximum = target.section === 'aptitude' ? counts?.aptitudeCount : counts?.practicalCount;
  if (!validIndex(target.index, Number(maximum) || 0)) return { ok: false, reason: 'invalid-target', progress: current };
  return {
    ok: true,
    progress: {
      ...current,
      phase: target.section,
      aptitudeIndex: target.section === 'aptitude' ? target.index : current.aptitudeIndex,
      practicalIndex: target.section === 'practical' ? target.index : current.practicalIndex,
      returnToReview: true
    }
  };
}

/** Build a display-only response review. Scoring remains in the existing recruitment result flow. */
export function buildAssessmentReview({ aptitudeQuestions = [], practicalSteps = [], aptitudeAnswers = [], practicalAnswers = [] } = {}) {
  const items = [];
  const unanswered = [];
  const breaches = [];
  const append = (collection, answers, section, promptOf, titleOf) => {
    collection.forEach((source, index) => {
      const options = Array.isArray(source?.options) ? source.options : [];
      const answerIndex = answers[index];
      const answered = validAnswer(answerIndex, options);
      const option = answered ? options[answerIndex] : null;
      const item = {
        section,
        index,
        number: index + 1,
        title: String(titleOf(source) || `${section} ${index + 1}`),
        prompt: String(promptOf(source) || ''),
        answered,
        answerIndex: answered ? answerIndex : null,
        response: option ? String(option.label || '') : '',
        criticalBreach: Boolean(option?.breach)
      };
      items.push(item);
      if (!answered) unanswered.push({ section, index, title: item.title });
      if (item.criticalBreach) breaches.push({ section, index, title: item.title });
    });
  };
  append(aptitudeQuestions, aptitudeAnswers, 'aptitude', item => item.question, item => item.category);
  append(practicalSteps, practicalAnswers, 'practical', item => item.prompt, item => item.label);
  const answeredCount = items.length - unanswered.length;
  return {
    items,
    unanswered,
    criticalBreaches: breaches,
    answeredCount,
    totalCount: items.length,
    complete: items.length > 0 && unanswered.length === 0
  };
}

export function applyAssessmentProgress(state, progress) {
  state.assessmentPhase = progress.phase;
  state.assessmentIndex = progress.aptitudeIndex;
  state.practicalIndex = progress.practicalIndex;
  state.assessmentReturnToReview = progress.returnToReview;
  return state;
}

export function readAssessmentProgress(state) {
  return {
    phase: state.assessmentPhase,
    aptitudeIndex: state.assessmentIndex,
    practicalIndex: state.practicalIndex,
    aptitudeAnswers: state.assessmentAnswers,
    practicalAnswers: state.practicalAnswers,
    returnToReview: state.assessmentReturnToReview
  };
}

/** Resolve a numeric keyboard shortcut (1-based) to an answer option index. */
export function assessmentAnswerShortcut(key, optionCount) {
  const count = Math.max(0, Number(optionCount) || 0);
  if (typeof key !== 'string' || !/^[1-9]$/.test(key)) return null;
  const index = Number(key) - 1;
  return index >= 0 && index < count ? index : null;
}
