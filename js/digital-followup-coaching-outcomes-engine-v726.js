/**
 * CALLORIA v7.26 — evidence-based coaching outcome review.
 * Pure local simulation logic. Outcome reviews are supervisory notes, not
 * automated disciplinary, compensation or employment decisions.
 */
export const DIGITAL_FOLLOWUP_COACHING_OUTCOMES_VERSION = '7.26.0';
const VALID_FOCI = new Set(['overdue_recovery', 'at_risk_prevention', 'response_sla_consistency']);
const VALID_OUTCOMES = new Set(['achieved', 'improving', 'not_improved', 'insufficient_data']);

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function safeText(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 160);
}
function normaliseScorecard(scorecard) {
  if (!scorecard || typeof scorecard !== 'object' || Array.isArray(scorecard)) return null;
  const agentId = safeText(scorecard.agentId);
  if (!agentId || agentId === 'UNASSIGNED' || agentId === 'ALL_AGENTS') return null;
  return {
    agentId,
    overdue: finite(scorecard.overdue),
    atRisk: finite(scorecard.atRisk),
    completed: finite(scorecard.completed),
    late: finite(scorecard.late),
    responseTargetRate: finite(scorecard.responseTargetRate)
  };
}
function snapshot(scorecard) {
  return {
    overdue: scorecard.overdue,
    atRisk: scorecard.atRisk,
    completed: scorecard.completed,
    late: scorecard.late,
    responseTargetRate: scorecard.responseTargetRate
  };
}

/** Assess a completed coaching plan against a fresh agent scorecard. */
export function assessDigitalFollowUpCoachingOutcome(plan, currentScorecard, options = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null;
  if (String(plan.status || '').toLowerCase() !== 'completed') return null;
  if (!VALID_FOCI.has(String(plan.focus || ''))) return null;
  if (plan.outcomeReview) return null;

  const baseline = plan.baseline && typeof plan.baseline === 'object' ? plan.baseline : {};
  const target = plan.target && typeof plan.target === 'object' ? plan.target : {};
  const current = normaliseScorecard(currentScorecard);
  if (!current || current.agentId !== safeText(plan.agentId)) return null;

  let metric = null;
  let before = null;
  let now = null;
  let targetValue = null;
  let delta = null;
  let achieved = false;
  let improved = false;
  let unit = 'items';

  if (plan.focus === 'overdue_recovery') {
    metric = 'overdue'; before = finite(baseline.overdue); now = current.overdue;
    targetValue = finite(target.overdue, 0); delta = before === null || now === null ? null : before - now;
    achieved = now !== null && now <= targetValue; improved = delta !== null && delta > 0;
  } else if (plan.focus === 'at_risk_prevention') {
    metric = 'atRisk'; before = finite(baseline.atRisk); now = current.atRisk;
    targetValue = finite(target.atRisk, 0); delta = before === null || now === null ? null : before - now;
    achieved = now !== null && now <= targetValue; improved = delta !== null && delta > 0;
  } else {
    metric = 'responseTargetRate'; before = finite(baseline.responseTargetRate);
    now = current.responseTargetRate; targetValue = finite(target.responseTargetRate);
    unit = '%'; delta = before === null || now === null ? null : now - before;
    if (now === null || targetValue === null) {
      achieved = false; improved = false;
    } else {
      achieved = now >= targetValue;
      improved = before !== null && now > before;
    }
  }

  const hasEvidence = plan.focus === 'response_sla_consistency'
    ? current.completed !== null && current.completed >= 3 && now !== null && targetValue !== null
    : before !== null && now !== null;
  const status = !hasEvidence ? 'insufficient_data'
    : achieved ? 'achieved'
      : improved ? 'improving' : 'not_improved';
  const labels = {
    achieved: 'Target achieved',
    improving: 'Positive movement; target not yet reached',
    not_improved: 'Target not reached; no positive movement recorded',
    insufficient_data: 'Insufficient evidence for an outcome judgement'
  };
  const reviewedAt = new Date(Date.parse(options.reviewedAt ?? '') || Date.now()).toISOString();

  return {
    status,
    label: labels[status],
    metric,
    unit,
    before,
    current: now,
    target: targetValue,
    delta,
    evidence: snapshot(current),
    evidenceScope: 'Current retained synthetic digital queue scorecard at review time; not isolated to the coaching period.',
    reviewedAt,
    reviewedBy: safeText(options.reviewedBy, 'SUPERVISOR'),
    note: status === 'achieved'
      ? 'The recorded follow-up measure meets the coaching target.'
      : status === 'improving'
        ? 'The measure has improved against baseline but remains short of the target.'
        : status === 'not_improved'
          ? 'The latest recorded measure does not show improvement against baseline.'
          : 'There is not enough comparable response evidence to judge the coaching outcome.'
  };
}

/** Immutable plan update; permits one outcome review per completed plan. */
export function recordDigitalFollowUpCoachingOutcome(plans, planId, performanceBoard, options = {}) {
  const rows = Array.isArray(plans) ? plans : [];
  const id = safeText(planId);
  if (!id || !Array.isArray(performanceBoard?.agents)) return rows.slice();
  const index = rows.findIndex(plan => plan && String(plan.id || '') === id
    && String(plan.status || '').toLowerCase() === 'completed'
    && !plan.outcomeReview);
  if (index < 0) return rows.slice();

  const plan = rows[index];
  const scorecard = performanceBoard.agents.find(item => safeText(item?.agentId) === safeText(plan.agentId));
  const review = assessDigitalFollowUpCoachingOutcome(plan, scorecard, options);
  if (!review) return rows.slice();

  const next = rows.slice();
  next[index] = { ...plan, outcomeReview: review };
  return next;
}

/** Build a compact, deterministic supervisor view of completed plans. */
export function digitalFollowUpCoachingOutcomeBoard(plans, performanceBoard) {
  const sourcePlans = Array.isArray(plans) ? plans : [];
  const agents = Array.isArray(performanceBoard?.agents) ? performanceBoard.agents : [];
  const rows = sourcePlans
    .filter(plan => plan && String(plan.status || '').toLowerCase() === 'completed')
    .map(plan => {
      const agent = agents.find(item => safeText(item?.agentId) === safeText(plan.agentId)) || null;
      const review = plan.outcomeReview && VALID_OUTCOMES.has(String(plan.outcomeReview.status))
        ? plan.outcomeReview : null;
      return {
        planId: safeText(plan.id),
        agentId: safeText(plan.agentId),
        focusLabel: safeText(plan.focusLabel, plan.focus),
        completedAt: safeText(plan.completedAt),
        reviewed: Boolean(review),
        outcomeReview: review,
        currentEvidenceAvailable: Boolean(normaliseScorecard(agent)),
        preview: review ? null : assessDigitalFollowUpCoachingOutcome(plan, agent, { reviewedAt: new Date(0).toISOString() })
      };
    })
    .sort((a, b) => (Date.parse(b.completedAt) || 0) - (Date.parse(a.completedAt) || 0));

  return {
    version: DIGITAL_FOLLOWUP_COACHING_OUTCOMES_VERSION,
    total: rows.length,
    reviewed: rows.filter(row => row.reviewed).length,
    awaitingReview: rows.filter(row => !row.reviewed && row.preview && row.preview.status !== 'insufficient_data').length,
    achieved: rows.filter(row => row.outcomeReview?.status === 'achieved').length,
    improving: rows.filter(row => row.outcomeReview?.status === 'improving').length,
    notImproved: rows.filter(row => row.outcomeReview?.status === 'not_improved').length,
    insufficientData: rows.filter(row => row.outcomeReview?.status === 'insufficient_data').length,
    rows
  };
}
