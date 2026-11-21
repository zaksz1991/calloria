/**
 * CALLORIA v6.96 — read-only reopened-case workload and ownership visibility.
 * Operates only on the synthetic follow-up rows already prepared by the CRM.
 */
export const CASE_FOLLOWUP_WORKLOAD_VERSION = '6.96.0';

function text(value, max = 140) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function finiteInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function exposureFor(group) {
  if (group.supervisorReview > 0) return 'SUPERVISOR REVIEW';
  if (group.overdue > 0) return 'OVERDUE';
  if (group.urgent > 0) return 'URGENT ITEMS';
  if (group.dueSoon > 0) return 'DUE SOON';
  if (group.open >= 4) return 'MULTIPLE CASES';
  return 'MONITOR';
}

const EXPOSURE_ORDER = new Map([
  ['SUPERVISOR REVIEW', 0],
  ['OVERDUE', 1],
  ['URGENT ITEMS', 2],
  ['DUE SOON', 3],
  ['MULTIPLE CASES', 4],
  ['MONITOR', 5]
]);

/**
 * Build per-owner counts without mutating case records or changing assignments.
 * `rows` is the `caseFollowUpMetrics(...).rows` result from case-lifecycle-engine.
 */
export function summariseCaseFollowUpWorkload(rows = []) {
  const groups = new Map();
  const exceptions = [];
  const totals = {
    open: 0,
    urgent: 0,
    overdue: 0,
    dueSoon: 0,
    supervisorReview: 0,
    inProgress: 0,
    unassigned: 0,
    claimIntegrityFlags: 0
  };

  for (const entry of Array.isArray(rows) ? rows : []) {
    const followUp = entry?.followUp;
    if (!followUp || typeof followUp !== 'object' || Array.isArray(followUp)) continue;
    const status = text(followUp.status, 40).toLowerCase();
    if (!status || status === 'complete') continue;

    const rawOwner = text(followUp.owner, 100);
    const owner = rawOwner || 'Unassigned';
    const ownerKey = rawOwner ? rawOwner.toLocaleLowerCase() : '__unassigned__';
    if (!groups.has(ownerKey)) {
      groups.set(ownerKey, {
        owner,
        assigned: Boolean(rawOwner),
        open: 0,
        urgent: 0,
        overdue: 0,
        dueSoon: 0,
        supervisorReview: 0,
        inProgress: 0,
        nextDueDay: null,
        nextDueMinute: null,
        nextDueAbsolute: Number.POSITIVE_INFINITY,
        activeHandlers: new Set()
      });
    }

    const group = groups.get(ownerKey);
    const priority = text(followUp.priority, 20).toLowerCase();
    const riskState = text(entry?.risk?.state, 40).toLowerCase();
    const claimedBy = text(followUp.claimedBy, 100);
    const dueDay = Math.max(1, finiteInteger(followUp.dueDay, 1));
    const dueMinute = Math.max(0, Math.min(1439, finiteInteger(followUp.dueMinute, 0)));
    const dueAbsolute = (dueDay - 1) * 1440 + dueMinute;

    group.open += 1;
    if (priority === 'urgent') group.urgent += 1;
    if (riskState === 'overdue') group.overdue += 1;
    if (riskState === 'due_soon') group.dueSoon += 1;
    if (status === 'supervisor_review') group.supervisorReview += 1;
    if (status === 'in_progress') group.inProgress += 1;
    if (claimedBy) group.activeHandlers.add(claimedBy);
    if (dueAbsolute < group.nextDueAbsolute) {
      group.nextDueAbsolute = dueAbsolute;
      group.nextDueDay = dueDay;
      group.nextDueMinute = dueMinute;
    }

    totals.open += 1;
    if (priority === 'urgent') totals.urgent += 1;
    if (riskState === 'overdue') totals.overdue += 1;
    if (riskState === 'due_soon') totals.dueSoon += 1;
    if (status === 'supervisor_review') totals.supervisorReview += 1;
    if (status === 'in_progress') totals.inProgress += 1;

    const caseReference = text(entry?.caseRecord?.reference || followUp.id || 'Unreferenced case', 100);
    if (!rawOwner) {
      totals.unassigned += 1;
      exceptions.push({ type: 'missing_owner', owner: 'Unassigned', caseReference, message: 'No follow-up owner is recorded.' });
    }
    if (status === 'in_progress' && !claimedBy) {
      totals.claimIntegrityFlags += 1;
      exceptions.push({ type: 'missing_claimant', owner, caseReference, message: 'Follow-up is marked in progress but has no recorded handler.' });
    }
    if (status === 'open' && claimedBy) {
      totals.claimIntegrityFlags += 1;
      exceptions.push({ type: 'stale_claim', owner, caseReference, message: `Open follow-up still contains a claim by ${claimedBy}.` });
    }
  }

  const owners = [...groups.values()].map(group => {
    const activeHandlers = [...group.activeHandlers].sort((a, b) => a.localeCompare(b));
    const output = {
      ...group,
      activeHandlers,
      activeHandlerCount: activeHandlers.length
    };
    output.exposure = exposureFor(output);
    delete output.nextDueAbsolute;
    return output;
  }).sort((a, b) => {
    const exposureDelta = (EXPOSURE_ORDER.get(a.exposure) ?? 9) - (EXPOSURE_ORDER.get(b.exposure) ?? 9);
    if (exposureDelta) return exposureDelta;
    return b.open - a.open || a.owner.localeCompare(b.owner);
  });

  exceptions.sort((a, b) => a.type.localeCompare(b.type) || a.caseReference.localeCompare(b.caseReference));
  return {
    version: CASE_FOLLOWUP_WORKLOAD_VERSION,
    ...totals,
    ownerCount: owners.filter(group => group.assigned).length,
    owners,
    exceptions
  };
}

function defaultEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Render the CRM workload panel. All dynamic text is escaped before HTML output. */
export function renderCaseFollowUpWorkloadPanel(summary, helpers = {}) {
  const data = summary && typeof summary === 'object' ? summary : summariseCaseFollowUpWorkload([]);
  const escape = typeof helpers.escapeHTML === 'function' ? helpers.escapeHTML : defaultEscape;
  const formatClock = typeof helpers.formatCaseClock === 'function'
    ? helpers.formatCaseClock
    : (minutes => `${String(Math.floor(Math.max(0, Number(minutes) || 0) / 60)).padStart(2, '0')}:${String(Math.max(0, Number(minutes) || 0) % 60).padStart(2, '0')}`);

  const rows = (Array.isArray(data.owners) ? data.owners : []).map(group => {
    const nextDue = group.nextDueDay == null
      ? '—'
      : `Day ${finiteInteger(group.nextDueDay, 1)} · ${formatClock(group.nextDueMinute)}`;
    const tone = ['SUPERVISOR REVIEW', 'OVERDUE'].includes(group.exposure)
      ? 'red'
      : ['URGENT ITEMS', 'DUE SOON', 'MULTIPLE CASES'].includes(group.exposure) ? 'amber' : 'green';
    const handlers = Array.isArray(group.activeHandlers) && group.activeHandlers.length
      ? group.activeHandlers.map(escape).join(', ')
      : '—';
    return `<tr><td><strong>${escape(group.owner)}</strong><small>${group.activeHandlerCount || 0} recorded claimant(s): ${handlers}</small></td><td>${group.open}</td><td>${group.urgent}</td><td>${group.overdue}</td><td>${group.dueSoon}</td><td>${group.inProgress}</td><td><span class="pill ${tone}">${escape(group.exposure)}</span></td><td>${escape(nextDue)}</td></tr>`;
  }).join('');

  const exceptionRows = (Array.isArray(data.exceptions) ? data.exceptions : []).map(issue =>
    `<li><strong>${escape(issue.caseReference)}</strong><span>${escape(issue.message)}</span></li>`
  ).join('');

  const stats = [
    ['OWNERS WITH WORK', data.ownerCount || 0],
    ['UNASSIGNED', data.unassigned || 0],
    ['URGENT FOLLOW-UPS', data.urgent || 0],
    ['CLAIM FLAGS', data.claimIntegrityFlags || 0]
  ].map(([label, value]) => `<div class="case-workload-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');

  return `<section class="panel case-owner-workload-panel" aria-label="Case follow-up owner workload"><div class="panel-head"><div><h3>Follow-up ownership & workload</h3><p>Read-only distribution of active reopened cases by recorded owner.</p></div><span class="pill ${data.overdue || data.supervisorReview || data.claimIntegrityFlags ? 'amber' : 'green'}">${data.open || 0} ACTIVE</span></div><div class="case-workload-stats">${stats}</div><div class="case-workload-table-wrap"><table class="case-workload-table"><thead><tr><th>Recorded owner / handler</th><th>Open</th><th>Urgent</th><th>Overdue</th><th>Due soon</th><th>In progress</th><th>Exposure</th><th>Next due</th></tr></thead><tbody>${rows || '<tr><td colspan="8"><div class="case-workload-empty">No active follow-up ownership to summarise.</div></td></tr>'}</tbody></table></div><div class="case-workload-exceptions"><div><strong>Ownership integrity checks</strong><small>These checks flag incomplete assignment metadata; they do not change records.</small></div>${exceptionRows ? `<ul>${exceptionRows}</ul>` : '<p class="case-workload-clear">No missing-owner or claim-state exceptions detected.</p>'}</div><p class="muted-note">Exposure labels are queue visibility indicators, not a staffing-capacity assessment or employee performance rating. No case is reassigned, claimed, closed or edited by this panel.</p></section>`;
}
