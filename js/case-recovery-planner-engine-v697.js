/**
 * CALLORIA v6.97 — simulated case-recovery action planner.
 * Read-only: derives a ranked worklist from the CRM's existing follow-up rows.
 * It never edits cases, assignments, claimant fields, history or save state.
 */
export const CASE_RECOVERY_PLANNER_VERSION = '6.97.0';

const ACTIVE = new Set(['open', 'in_progress', 'supervisor_review']);
const STATE_WEIGHT = Object.freeze({
  supervisor_review: 0,
  overdue: 1,
  due_soon: 2,
  on_track: 3,
  paused_off_shift: 4,
  clock_unavailable: 5
});

function safeText(value, max = 180) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function finiteInt(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function actionFor({ status, riskState, owner, claimedBy }) {
  if (status === 'supervisor_review' || riskState === 'supervisor_review') {
    return 'Independent supervisor decision is required. Review the evidence and record a reasoned outcome.';
  }
  if (riskState === 'overdue') {
    return 'Past the simulated deadline. Address the customer commitment first and record the actual next step.';
  }
  if (riskState === 'due_soon') {
    return 'Deadline is within 15 simulated minutes. Prioritise this before lower-risk follow-ups.';
  }
  if (riskState === 'clock_unavailable') {
    return 'The simulated clock is unavailable. Restore the active shift clock before judging SLA exposure.';
  }
  if (riskState === 'paused_off_shift') {
    return 'The SLA clock is paused off shift. Keep this visible for the next active shift.';
  }
  if (!owner) {
    return 'No named owner is recorded. Confirm ownership in the existing case workflow before work begins.';
  }
  if (status === 'in_progress' && !claimedBy) {
    return 'The case is marked in progress without a recorded claimant. Reconcile ownership in the case record.';
  }
  if (status === 'open' && claimedBy) {
    return 'An open case retains a claimant. Reconcile the stale claim before another employee starts work.';
  }
  if (status === 'in_progress') {
    return 'Continue the claimed follow-up. Record factual checks, customer response and the next commitment.';
  }
  return 'Claim the follow-up through the existing CRM case action and record the customer contact.';
}

function classify(row) {
  const followUp = row?.followUp;
  const status = safeText(followUp?.status, 40).toLowerCase();
  if (!followUp || !ACTIVE.has(status)) return null;

  const riskState = safeText(row?.risk?.state, 40).toLowerCase() || 'clock_unavailable';
  const rawDelta = finiteInt(row?.risk?.deltaMinutes, null);
  const owner = safeText(followUp.owner, 100);
  const claimedBy = safeText(followUp.claimedBy, 100);
  const priority = safeText(followUp.priority, 20).toLowerCase() === 'urgent' ? 'urgent' : 'normal';
  const dueDay = Math.max(1, finiteInt(followUp.dueDay, 1));
  const dueMinute = Math.max(0, Math.min(1439, finiteInt(followUp.dueMinute, 0)));
  const dueAbsolute = (dueDay - 1) * 1440 + dueMinute;
  const caseRecord = row?.caseRecord && typeof row.caseRecord === 'object' ? row.caseRecord : {};
  const reference = safeText(caseRecord.reference || followUp.id || 'Unreferenced case', 100);
  const customer = safeText(caseRecord.customer || 'Customer not recorded', 120);
  const title = safeText(caseRecord.title || followUp.reason || 'Case follow-up', 180);
  const attempts = Math.max(0, finiteInt(followUp.attempts, 0));
  const action = actionFor({ status, riskState, owner, claimedBy });

  let bucket = 'scheduled';
  if (status === 'supervisor_review' || riskState === 'supervisor_review') bucket = 'supervisor_review';
  else if (riskState === 'overdue' || (rawDelta !== null && rawDelta < 0)) bucket = 'overdue';
  else if (riskState === 'clock_unavailable') bucket = 'clock_unavailable';
  else if (riskState === 'paused_off_shift') bucket = 'paused_off_shift';
  else if (rawDelta === 0) bucket = 'due_now';
  else if (rawDelta !== null && rawDelta > 0 && rawDelta <= 15) bucket = 'due_15';
  else if (rawDelta !== null && rawDelta > 15 && rawDelta <= 60) bucket = 'due_60';

  const stateWeight = STATE_WEIGHT[riskState] ?? 6;
  const ownershipPenalty = !owner || (status === 'in_progress' && !claimedBy) || (status === 'open' && claimedBy) ? 1 : 0;
  const priorityWeight = priority === 'urgent' ? 0 : 1;
  const sortableDelta = rawDelta == null ? Number.POSITIVE_INFINITY : rawDelta;

  return {
    reference,
    customer,
    title,
    owner: owner || 'Unassigned',
    claimedBy,
    status,
    priority,
    riskState,
    deltaMinutes: rawDelta,
    dueDay,
    dueMinute,
    dueAbsolute,
    attempts,
    bucket,
    action,
    severityRank: stateWeight * 100 + ownershipPenalty * 10 + priorityWeight,
    sortableDelta
  };
}

/** Build a deterministic, non-mutating action plan from caseFollowUpMetrics.rows. */
export function buildCaseRecoveryPlan(rows = [], options = {}) {
  const limit = Math.max(1, Math.min(12, finiteInt(options.limit, 8) ?? 8));
  const items = [];
  const owners = new Set();
  const totals = {
    active: 0,
    supervisorReview: 0,
    overdue: 0,
    dueNow: 0,
    dueWithin15: 0,
    dueWithin60: 0,
    unassigned: 0,
    pausedOffShift: 0,
    clockUnavailable: 0,
    ownershipFlags: 0
  };

  for (const row of Array.isArray(rows) ? rows : []) {
    const item = classify(row);
    if (!item) continue;
    totals.active += 1;
    if (item.owner !== 'Unassigned') owners.add(item.owner.toLocaleLowerCase());
    if (item.bucket === 'supervisor_review') totals.supervisorReview += 1;
    if (item.bucket === 'overdue') totals.overdue += 1;
    if (item.bucket === 'due_now') totals.dueNow += 1;
    if (['due_now', 'due_15'].includes(item.bucket)) totals.dueWithin15 += 1;
    if (['due_now', 'due_15', 'due_60'].includes(item.bucket)) totals.dueWithin60 += 1;
    if (item.owner === 'Unassigned') totals.unassigned += 1;
    if (item.bucket === 'paused_off_shift') totals.pausedOffShift += 1;
    if (item.bucket === 'clock_unavailable') totals.clockUnavailable += 1;
    if (item.owner === 'Unassigned' || (item.status === 'in_progress' && !item.claimedBy) || (item.status === 'open' && item.claimedBy)) totals.ownershipFlags += 1;
    items.push(item);
  }

  items.sort((a, b) =>
    a.severityRank - b.severityRank ||
    a.sortableDelta - b.sortableDelta ||
    b.attempts - a.attempts ||
    a.reference.localeCompare(b.reference)
  );

  const visibleItems = items.slice(0, limit).map(item => {
    const { severityRank, sortableDelta, ...safeItem } = item;
    return safeItem;
  });

  return {
    version: CASE_RECOVERY_PLANNER_VERSION,
    ...totals,
    ownerCount: owners.size,
    totalItems: items.length,
    visibleLimit: limit,
    hiddenItems: Math.max(0, items.length - limit),
    items: visibleItems
  };
}

function escapeDefault(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deadlineLabel(item, formatClock) {
  if (item.bucket === 'supervisor_review') return 'SUPERVISOR DECISION';
  if (item.bucket === 'overdue') {
    const minutes = item.deltaMinutes == null ? null : Math.abs(item.deltaMinutes);
    return minutes == null ? 'OVERDUE' : `OVERDUE · ${minutes}m`;
  }
  if (item.bucket === 'due_now') return 'DUE NOW';
  if (item.bucket === 'due_15' || item.bucket === 'due_60') return `DUE IN ${item.deltaMinutes}m`;
  if (item.bucket === 'clock_unavailable') return 'CLOCK UNAVAILABLE';
  if (item.bucket === 'paused_off_shift') return `PAUSED · DAY ${item.dueDay} ${formatClock(item.dueMinute)}`;
  return `DAY ${item.dueDay} · ${formatClock(item.dueMinute)}`;
}

/** Render the case recovery board; all user-controlled strings are escaped. */
export function renderCaseRecoveryPlanPanel(plan, helpers = {}) {
  const data = plan && typeof plan === 'object' ? plan : buildCaseRecoveryPlan([]);
  const escape = typeof helpers.escapeHTML === 'function' ? helpers.escapeHTML : escapeDefault;
  const formatClock = typeof helpers.formatCaseClock === 'function'
    ? helpers.formatCaseClock
    : (minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);

  const stats = [
    ['IMMEDIATE ACTION', (data.supervisorReview || 0) + (data.overdue || 0) + (data.dueNow || 0)],
    ['DUE WITHIN 15 MIN', data.dueWithin15 || 0],
    ['DUE WITHIN 60 MIN', data.dueWithin60 || 0],
    ['UNASSIGNED', data.unassigned || 0]
  ].map(([label, value]) => `<div class="case-recovery-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');

  const cards = (Array.isArray(data.items) ? data.items : []).map(item => {
    const badge = item.bucket === 'supervisor_review' || item.bucket === 'overdue' ? 'red'
      : ['due_now', 'due_15', 'due_60', 'clock_unavailable'].includes(item.bucket) ? 'amber' : 'green';
    const ownerLine = item.claimedBy
      ? `${escape(item.owner)} · handled by ${escape(item.claimedBy)}`
      : escape(item.owner);
    const actionButton = item.reference
      ? `<button class="btn small outline" data-action="open-case-followup" data-case-reference="${escape(item.reference)}">Open case</button>`
      : '';
    return `<article class="case-recovery-card"><div class="case-recovery-card-main"><div class="case-recovery-meta"><span class="pill ${badge}">${escape(item.bucket.replaceAll('_', ' ').toUpperCase())}</span><span class="pill">${escape(item.priority.toUpperCase())}</span><small>${escape(deadlineLabel(item, formatClock))}</small></div><h4>${escape(item.customer)} <span>· ${escape(item.reference)}</span></h4><p>${escape(item.title)}</p><div class="case-recovery-owner">${ownerLine} · ${escape(item.status.replaceAll('_', ' '))} · ${item.attempts} attempt(s)</div><div class="case-recovery-next"><strong>NEXT ACTION</strong><span>${escape(item.action)}</span></div></div><div class="case-recovery-card-action">${actionButton}</div></article>`;
  }).join('');

  const empty = '<div class="case-recovery-empty"><strong>No active reopened-case work.</strong><span>New follow-ups will appear here after a case is reopened.</span></div>';
  return `<section class="panel case-recovery-planner" aria-label="Case recovery action planner"><div class="panel-head"><div><h3>Case recovery action planner</h3><p>Prioritised next actions from the existing simulated case clock and follow-up records.</p></div><span class="pill ${(data.supervisorReview || data.overdue || data.dueNow) ? 'amber' : 'green'}">${data.totalItems || 0} ACTIVE</span></div><div class="case-recovery-stats">${stats}</div><div class="case-recovery-list">${cards || empty}</div><div class="case-recovery-footer"><span>${data.totalItems || 0} active item(s) · ${data.hiddenItems || 0} additional item(s) not shown · ${data.ownerCount || 0} recorded owner(s)</span><span>Advisory only · existing CRM actions remain authoritative</span></div></section>`;
}
