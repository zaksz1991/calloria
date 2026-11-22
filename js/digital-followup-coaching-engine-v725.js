/**
 * CALLORIA v7.25 — evidence-led coaching plans for synthetic digital follow-ups.
 * Pure local simulation logic. This is a support workflow, not an automated
 * disciplinary or employment decision system.
 */
export const DIGITAL_FOLLOWUP_COACHING_VERSION = '7.25.0';
const ACTIVE = new Set(['open', 'in_progress']);
const STATUSES = new Set(['open', 'in_progress', 'completed', 'cancelled']);
const FOCUS = Object.freeze({
  overdue_recovery: {
    label: 'Overdue follow-up recovery',
    objective: 'Clear overdue customer follow-ups and keep every open follow-up inside its response target.',
    practice: 'Review the oldest waiting threads first, acknowledge the customer, give a specific next update, and record the next action.'
  },
  at_risk_prevention: {
    label: 'At-risk queue prevention',
    objective: 'Reduce at-risk open follow-ups to zero through earlier queue checks and timely ownership.',
    practice: 'Check the follow-up queue at set intervals, sort by remaining SLA time, and reassign work before it breaches.'
  },
  response_sla_consistency: {
    label: 'Response target consistency',
    objective: 'Reach at least 85% of completed follow-up replies within their channel response targets.',
    practice: 'Use a concise acknowledgement, confirm the requested update, and send a factual response before the channel target expires.'
  }
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function safeText(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 160);
}
function validDate(value) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : null;
}
function normaliseStatus(value) {
  const status = String(value ?? '').trim().toLowerCase();
  return STATUSES.has(status) ? status : 'cancelled';
}
function activePlanForAgent(plans, agentId) {
  return plans.find(plan => plan && safeText(plan.agentId) === agentId && ACTIVE.has(normaliseStatus(plan.status)));
}
function recommendationForAgent(agent) {
  const agentId = safeText(agent?.agentId);
  if (!agentId || agentId === 'UNASSIGNED' || agentId === 'ALL_AGENTS') return null;

  const overdue = Math.max(0, Math.floor(finite(agent.overdue)));
  const atRisk = Math.max(0, Math.floor(finite(agent.atRisk)));
  const completed = Math.max(0, Math.floor(finite(agent.completed)));
  const late = Math.max(0, Math.floor(finite(agent.late)));
  const hasRate = agent.responseTargetRate !== null && agent.responseTargetRate !== undefined && agent.responseTargetRate !== '';
  const rate = hasRate && Number.isFinite(Number(agent.responseTargetRate)) ? Number(agent.responseTargetRate) : null;

  // Rank by the most immediate operational risk; issue one coaching focus per agent.
  let focus = null;
  let priority = 'medium';
  if (overdue > 0) {
    focus = 'overdue_recovery';
    priority = overdue >= 3 ? 'high' : 'medium';
  } else if (atRisk >= 2) {
    focus = 'at_risk_prevention';
    priority = atRisk >= 4 ? 'high' : 'medium';
  } else if (completed >= 3 && rate !== null && rate < 85) {
    focus = 'response_sla_consistency';
    priority = rate < 65 ? 'high' : 'medium';
  } else {
    return null;
  }

  const definition = FOCUS[focus];
  const targetRate = focus === 'response_sla_consistency'
    ? Math.min(95, Math.max(85, Math.round((rate ?? 0) + 15)))
    : null;
  return {
    agentId,
    focus,
    focusLabel: definition.label,
    priority,
    baseline: { overdue, atRisk, completed, late, responseTargetRate: rate },
    target: focus === 'response_sla_consistency'
      ? { responseTargetRate: targetRate }
      : focus === 'overdue_recovery'
        ? { overdue: 0 }
        : { atRisk: 0 },
    objective: focus === 'response_sla_consistency'
      ? `Improve the completed follow-up response target rate from ${Math.round(rate)}% to at least ${targetRate}%.`
      : definition.objective,
    practice: definition.practice
  };
}

/**
 * Convert current response scorecards into one actionable coaching signal per
 * agent. Active plans suppress duplicate recommendations for that agent.
 */
export function digitalFollowUpCoachingBoard(performanceBoard, existingPlans = [], now = Date.now()) {
  const sourceAgents = Array.isArray(performanceBoard?.agents) ? performanceBoard.agents : [];
  const plans = Array.isArray(existingPlans)
    ? existingPlans.filter(plan => plan && typeof plan === 'object' && !Array.isArray(plan)).map(plan => ({
      id: safeText(plan.id),
      agentId: safeText(plan.agentId),
      focus: safeText(plan.focus),
      focusLabel: safeText(plan.focusLabel),
      priority: ['high', 'medium', 'low'].includes(String(plan.priority)) ? String(plan.priority) : 'medium',
      status: normaliseStatus(plan.status),
      objective: safeText(plan.objective),
      practice: safeText(plan.practice),
      createdAt: safeText(plan.createdAt),
      dueAt: safeText(plan.dueAt),
      startedAt: safeText(plan.startedAt),
      completedAt: safeText(plan.completedAt),
      baseline: plan.baseline && typeof plan.baseline === 'object' ? { ...plan.baseline } : {},
      target: plan.target && typeof plan.target === 'object' ? { ...plan.target } : {}
    }))
    : [];
  const recommendations = sourceAgents
    .map(recommendationForAgent)
    .filter(Boolean)
    .filter(item => !activePlanForAgent(plans, item.agentId))
    .sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1)
      || (b.baseline.overdue - a.baseline.overdue)
      || a.agentId.localeCompare(b.agentId));

  const validNow = Math.max(0, finite(now, Date.now()));
  const activePlans = plans.filter(plan => ACTIVE.has(plan.status));
  const completedPlans = plans.filter(plan => plan.status === 'completed');
  return {
    version: DIGITAL_FOLLOWUP_COACHING_VERSION,
    generatedAt: new Date(validNow).toISOString(),
    recommendations,
    plans: plans.sort((a, b) => (validDate(b.createdAt) ?? 0) - (validDate(a.createdAt) ?? 0)),
    activePlans,
    completedPlans,
    counts: {
      recommendations: recommendations.length,
      active: activePlans.length,
      completed: completedPlans.length,
      overduePlans: activePlans.filter(plan => {
        const due = validDate(plan.dueAt);
        return due !== null && due < validNow;
      }).length
    }
  };
}

/** Create a validated, auditable local coaching plan from a live recommendation. */
export function createDigitalFollowUpCoachingPlan(recommendation, options = {}) {
  if (!recommendation || typeof recommendation !== 'object' || Array.isArray(recommendation)) return null;
  const agentId = safeText(recommendation.agentId);
  const focus = safeText(recommendation.focus);
  if (!agentId || agentId === 'UNASSIGNED' || !FOCUS[focus]) return null;

  const createdAtMs = validDate(options.createdAt) ?? Date.now();
  const dueAtMs = validDate(options.dueAt) ?? createdAtMs + 7 * 24 * 60 * 60 * 1000;
  if (dueAtMs <= createdAtMs) return null;
  const id = safeText(options.id) || `COACH-${createdAtMs}-${agentId}`;
  const priority = ['high', 'medium', 'low'].includes(String(recommendation.priority))
    ? String(recommendation.priority) : 'medium';

  return {
    id,
    agentId,
    focus,
    focusLabel: FOCUS[focus].label,
    priority,
    status: 'open',
    objective: safeText(recommendation.objective, FOCUS[focus].objective),
    practice: safeText(recommendation.practice, FOCUS[focus].practice),
    baseline: recommendation.baseline && typeof recommendation.baseline === 'object' ? { ...recommendation.baseline } : {},
    target: recommendation.target && typeof recommendation.target === 'object' ? { ...recommendation.target } : {},
    createdAt: new Date(createdAtMs).toISOString(),
    dueAt: new Date(dueAtMs).toISOString(),
    startedAt: null,
    completedAt: null,
    createdBy: safeText(options.createdBy, 'SUPERVISOR')
  };
}

/** Immutable state transition helper; invalid transitions leave source untouched. */
export function transitionDigitalFollowUpCoachingPlan(plans, planId, nextStatus, at = new Date().toISOString()) {
  const rows = Array.isArray(plans) ? plans : [];
  const id = safeText(planId);
  const status = String(nextStatus ?? '').trim().toLowerCase();
  const atMs = validDate(at);
  if (!id || !atMs || !['in_progress', 'completed', 'cancelled'].includes(status)) return rows.slice();
  let changed = false;
  const next = rows.map(plan => {
    if (!plan || String(plan.id ?? '') !== id || !ACTIVE.has(normaliseStatus(plan.status))) return plan;
    const current = normaliseStatus(plan.status);
    const allowed = (current === 'open' && ['in_progress', 'cancelled'].includes(status))
      || (current === 'in_progress' && ['completed', 'cancelled'].includes(status));
    if (!allowed) return plan;
    changed = true;
    return {
      ...plan,
      status,
      ...(status === 'in_progress' ? { startedAt: new Date(atMs).toISOString() } : {}),
      ...(status === 'completed' ? { completedAt: new Date(atMs).toISOString() } : {}),
      ...(status === 'cancelled' ? { cancelledAt: new Date(atMs).toISOString() } : {})
    };
  });
  return changed ? next : rows.slice();
}
