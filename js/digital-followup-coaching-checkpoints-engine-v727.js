/**
 * CALLORIA v7.27 — scheduled coaching sustainment checkpoints.
 * Uses the retained digital follow-up scorecard at each checkpoint. The
 * comparison is operational evidence, not proof that coaching caused a change.
 */
export const DIGITAL_FOLLOWUP_COACHING_CHECKPOINTS_VERSION = '7.27.0';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECKPOINT_SPECS = Object.freeze([
  { key: 'day_7', daysAfterReview: 7, label: '7-day sustainment check' },
  { key: 'day_30', daysAfterReview: 30, label: '30-day sustainment check' }
]);
const VALID_FOCI = new Set(['overdue_recovery', 'at_risk_prevention', 'response_sla_consistency']);
const VALID_RESULTS = new Set(['target_maintained', 'target_reached', 'improved', 'regressed', 'stable', 'insufficient_data']);

function safeText(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 160);
}
function finite(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function time(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
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
function planMetric(plan) {
  if (plan.focus === 'overdue_recovery') {
    return { key: 'overdue', label: 'Overdue follow-ups', direction: 'lower', target: finite(plan.target?.overdue, 0) };
  }
  if (plan.focus === 'at_risk_prevention') {
    return { key: 'atRisk', label: 'At-risk follow-ups', direction: 'lower', target: finite(plan.target?.atRisk, 0) };
  }
  if (plan.focus === 'response_sla_consistency') {
    return { key: 'responseTargetRate', label: 'Response target rate', direction: 'higher', target: finite(plan.target?.responseTargetRate) };
  }
  return null;
}
function checkpointStatus(checkpoint, nowMs) {
  if (checkpoint?.review && typeof checkpoint.review === 'object') return 'recorded';
  const dueMs = time(checkpoint?.dueAt);
  if (dueMs === null) return 'invalid';
  return nowMs >= dueMs ? 'due' : 'scheduled';
}
function immutableRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

/**
 * Create the 7-day and 30-day checks once a completed plan has an outcome
 * review. Calling this repeatedly is safe and will not duplicate checkpoints.
 */
export function scheduleDigitalFollowUpCoachingCheckpoints(plans, planId, options = {}) {
  const rows = immutableRows(plans);
  const id = safeText(planId);
  if (!id) return rows.slice();
  const index = rows.findIndex(plan => plan && safeText(plan.id) === id);
  if (index < 0) return rows.slice();
  const plan = rows[index];
  if (String(plan.status || '').toLowerCase() !== 'completed' || !plan.outcomeReview) return rows.slice();
  if (!VALID_FOCI.has(String(plan.focus || ''))) return rows.slice();

  const anchorMs = time(options.scheduledAt ?? plan.outcomeReview.reviewedAt);
  if (anchorMs === null) return rows.slice();
  const existing = Array.isArray(plan.followUpCheckpoints) ? plan.followUpCheckpoints : [];
  const existingKeys = new Set(existing.map(item => safeText(item?.key)));
  const additions = CHECKPOINT_SPECS
    .filter(spec => !existingKeys.has(spec.key))
    .map(spec => ({
      id: `${safeText(plan.id)}-${spec.key.toUpperCase()}`.slice(0, 180),
      key: spec.key,
      label: spec.label,
      daysAfterReview: spec.daysAfterReview,
      status: 'pending',
      scheduledAt: new Date(anchorMs).toISOString(),
      dueAt: new Date(anchorMs + spec.daysAfterReview * DAY_MS).toISOString(),
      reference: plan.outcomeReview.evidence && typeof plan.outcomeReview.evidence === 'object'
        ? { ...plan.outcomeReview.evidence }
        : { [planMetric(plan)?.key || '']: finite(plan.outcomeReview.current) },
      review: null
    }));

  if (!additions.length) return rows.slice();
  const next = rows.slice();
  next[index] = { ...plan, followUpCheckpoints: [...existing, ...additions] };
  return next;
}

/** Evaluate a scheduled checkpoint against the outcome-review snapshot. */
export function assessDigitalFollowUpCoachingCheckpoint(plan, checkpoint, currentScorecard, options = {}) {
  if (!plan || typeof plan !== 'object' || !checkpoint || typeof checkpoint !== 'object') return null;
  if (String(plan.status || '').toLowerCase() !== 'completed' || !plan.outcomeReview) return null;
  if (!VALID_FOCI.has(String(plan.focus || ''))) return null;
  if (checkpoint.review) return null;
  const dueMs = time(checkpoint.dueAt);
  const recordedMs = time(options.recordedAt);
  const nowMs = time(options.now ?? options.recordedAt) ?? Date.now();
  if (dueMs === null || nowMs < dueMs || recordedMs === null) return null;

  const current = normaliseScorecard(currentScorecard);
  if (!current || current.agentId !== safeText(plan.agentId)) return null;
  const metric = planMetric(plan);
  if (!metric) return null;

  const reference = finite(checkpoint.reference?.[metric.key], finite(plan.outcomeReview.evidence?.[metric.key], finite(plan.outcomeReview.current)));
  const value = finite(current[metric.key]);
  const completedAtReview = finite(checkpoint.reference?.completed, finite(plan.outcomeReview.evidence?.completed, 0));
  const newCompleted = current.completed === null ? 0 : Math.max(0, current.completed - completedAtReview);
  const minimumSample = metric.key === 'responseTargetRate' ? 3 : 1;
  const hasEvidence = reference !== null && value !== null && newCompleted >= minimumSample;
  const target = metric.target;
  let result = 'insufficient_data';
  let delta = null;
  if (hasEvidence) {
    delta = metric.direction === 'lower' ? reference - value : value - reference;
    const atTarget = target !== null && (metric.direction === 'lower' ? value <= target : value >= target);
    if (atTarget) result = String(plan.outcomeReview.status) === 'achieved' ? 'target_maintained' : 'target_reached';
    else if (delta > 0) result = 'improved';
    else if (delta < 0) result = 'regressed';
    else result = 'stable';
  }

  const labels = {
    target_maintained: 'Previously achieved coaching target maintained',
    target_reached: 'Coaching target reached at this checkpoint',
    improved: 'Further improvement recorded',
    regressed: 'Performance regressed against outcome review',
    stable: 'Performance remained stable; target not met',
    insufficient_data: `Insufficient evidence: at least ${minimumSample} new completed follow-up${minimumSample === 1 ? '' : 's'} required`
  };
  return {
    status: result,
    label: labels[result],
    metric: metric.key,
    metricLabel: metric.label,
    direction: metric.direction,
    reference,
    current: value,
    target,
    delta,
    newCompleted,
    evidence: { ...current },
    evidenceScope: 'Retained cumulative synthetic digital follow-up scorecard compared with the scorecard captured at the initial coaching outcome review; not an isolated causal study.',
    recordedAt: new Date(recordedMs).toISOString(),
    recordedBy: safeText(options.recordedBy, 'SUPERVISOR')
  };
}

/** Record one due checkpoint. A checkpoint cannot be recorded early or twice. */
export function recordDigitalFollowUpCoachingCheckpoint(plans, planId, checkpointId, performanceBoard, options = {}) {
  const rows = immutableRows(plans);
  const id = safeText(planId);
  const checkId = safeText(checkpointId);
  if (!id || !checkId || !Array.isArray(performanceBoard?.agents)) return rows.slice();
  const index = rows.findIndex(plan => plan && safeText(plan.id) === id);
  if (index < 0) return rows.slice();
  const plan = rows[index];
  const checkpoints = Array.isArray(plan.followUpCheckpoints) ? plan.followUpCheckpoints : [];
  const checkpointIndex = checkpoints.findIndex(item => item && safeText(item.id) === checkId);
  if (checkpointIndex < 0) return rows.slice();
  const checkpoint = checkpoints[checkpointIndex];
  const scorecard = performanceBoard.agents.find(item => safeText(item?.agentId) === safeText(plan.agentId));
  const review = assessDigitalFollowUpCoachingCheckpoint(plan, checkpoint, scorecard, options);
  if (!review) return rows.slice();

  const nextCheckpoints = checkpoints.slice();
  nextCheckpoints[checkpointIndex] = { ...checkpoint, status: 'recorded', review };
  const next = rows.slice();
  next[index] = { ...plan, followUpCheckpoints: nextCheckpoints };
  return next;
}

/** Build counts and action-ready rows for the Supervisor workspace. */
export function digitalFollowUpCoachingCheckpointBoard(plans, performanceBoard, now = Date.now()) {
  const sourcePlans = immutableRows(plans);
  const agents = Array.isArray(performanceBoard?.agents) ? performanceBoard.agents : [];
  const nowMs = Math.max(0, finite(now, Date.now()));
  const unscheduledPlans = [];
  const rows = [];

  sourcePlans.forEach(plan => {
    if (!plan || String(plan.status || '').toLowerCase() !== 'completed' || !plan.outcomeReview) return;
    const checkpoints = Array.isArray(plan.followUpCheckpoints) ? plan.followUpCheckpoints : [];
    if (!checkpoints.length) unscheduledPlans.push({ planId: safeText(plan.id), agentId: safeText(plan.agentId), focusLabel: safeText(plan.focusLabel, plan.focus) });
    checkpoints.forEach(checkpoint => {
      const status = checkpointStatus(checkpoint, nowMs);
      const agent = agents.find(item => safeText(item?.agentId) === safeText(plan.agentId)) || null;
      rows.push({
        planId: safeText(plan.id),
        checkpointId: safeText(checkpoint.id),
        checkpointKey: safeText(checkpoint.key),
        checkpointLabel: safeText(checkpoint.label),
        agentId: safeText(plan.agentId),
        focusLabel: safeText(plan.focusLabel, plan.focus),
        dueAt: safeText(checkpoint.dueAt),
        status,
        review: checkpoint.review && VALID_RESULTS.has(String(checkpoint.review.status)) ? checkpoint.review : null,
        ready: status === 'due' && Boolean(normaliseScorecard(agent)),
        evidenceAvailable: Boolean(normaliseScorecard(agent))
      });
    });
  });

  rows.sort((a, b) => (time(a.dueAt) ?? 0) - (time(b.dueAt) ?? 0));
  return {
    version: DIGITAL_FOLLOWUP_COACHING_CHECKPOINTS_VERSION,
    total: rows.length,
    due: rows.filter(row => row.status === 'due').length,
    overdue: rows.filter(row => row.status === 'due' && (time(row.dueAt) ?? nowMs) < nowMs).length,
    recorded: rows.filter(row => row.status === 'recorded').length,
    scheduled: rows.filter(row => row.status === 'scheduled').length,
    insufficientData: rows.filter(row => row.review?.status === 'insufficient_data').length,
    unscheduledPlans,
    rows
  };
}
