/** CALLORIA v7.12 — read-only callback promise/task integrity audit. */
const ACTIVE_CALLBACK_STATUSES = new Set(['scheduled', 'queued', 'in_progress']);
const TERMINAL_CALLBACK_STATUSES = new Set(['completed', 'attempt_failed', 'cancelled', 'canceled', 'failed', 'abandoned']);
const OPEN_COMMITMENT_STATUSES = new Set(['Open']);
const REVIEW_COMMITMENT_STATUSES = new Set(['Needs review']);

function text(value, maximum = 180) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
}
function escapeHTML(value) {
  return text(value, 600).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function expectedDueTimestamp(commitment) {
  const date = String(commitment?.dueDate || ''), minutes = Number(commitment?.dueMinutes);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return null;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed.getTime();
}
function addIssue(issues, type, severity, commitment, callbacks, recommendation, detail) {
  issues.push({ type, severity, commitmentId: text(commitment?.id || callbacks?.[0]?.commitmentId, 100),
    customer: text(commitment?.customerName || callbacks?.[0]?.customer || 'Unknown customer', 100),
    owner: text(commitment?.owner || 'Unassigned', 100),
    callbackIds: (Array.isArray(callbacks) ? callbacks : []).map(row => text(row?.id, 100)).filter(Boolean),
    recommendation: text(recommendation, 220), detail: text(detail, 240) });
}

/** Legacy records with no commitmentId are counted separately and left untouched. */
export function auditCallbackIntegrity(commitmentState, callbackRecords) {
  const commitments = Array.isArray(commitmentState?.commitments) ? commitmentState.commitments.filter(row => row && typeof row === 'object') : [];
  const callbacks = Array.isArray(callbackRecords) ? callbackRecords.filter(row => row && typeof row === 'object') : [];
  const issues = [], commitmentGroups = new Map(), callbackGroups = new Map(), commitmentById = new Map();
  for (const commitment of commitments) {
    const id = text(commitment.id, 100);
    if (!id) { addIssue(issues, 'invalid-commitment-id', 'high', commitment, [], 'Review the malformed promise record before assigning a callback.', 'Formal commitment has no usable ID.'); continue; }
    const rows = commitmentGroups.get(id) || []; rows.push(commitment); commitmentGroups.set(id, rows);
    if (!commitmentById.has(id)) commitmentById.set(id, commitment);
  }
  for (const [id, rows] of commitmentGroups) if (rows.length > 1) addIssue(issues, 'duplicate-commitment-id', 'high', rows[0], [], 'Review duplicate promise records and preserve the authoritative history.', `${rows.length} commitment records share ID ${id}.`);
  let legacyUnlinked = 0, invalidCallbackIds = 0;
  for (const callback of callbacks) {
    if (!text(callback.id, 100)) invalidCallbackIds += 1;
    const commitmentId = text(callback.commitmentId, 100);
    if (!commitmentId) { legacyUnlinked += 1; continue; }
    const rows = callbackGroups.get(commitmentId) || []; rows.push(callback); callbackGroups.set(commitmentId, rows);
  }
  if (invalidCallbackIds) addIssue(issues, 'invalid-callback-id', 'medium', null, [], 'Inspect callback rows with missing IDs before relying on task-level actions.', `${invalidCallbackIds} callback record(s) have no usable ID.`);
  const activeCommitmentCount = commitments.filter(row => OPEN_COMMITMENT_STATUSES.has(row.status) || REVIEW_COMMITMENT_STATUSES.has(row.status)).length;
  let missingTasks = 0, duplicateTasks = 0, orphanTasks = 0, dueDrift = 0, staleActiveTasks = 0, closedWithActiveTasks = 0;
  for (const commitment of commitments) {
    const id = text(commitment.id, 100); if (!id) continue;
    const linked = callbackGroups.get(id) || [];
    const active = linked.filter(row => ACTIVE_CALLBACK_STATUSES.has(row.status));
    const terminal = linked.filter(row => TERMINAL_CALLBACK_STATUSES.has(row.status));
    if (commitment.status === 'Complete' && active.length) {
      closedWithActiveTasks += active.length;
      addIssue(issues, 'closed-promise-active-task', 'high', commitment, active, 'Verify the recorded customer outcome, then close or cancel stale active callback tasks.', 'A completed promise still has an active callback task.');
    }
    if (OPEN_COMMITMENT_STATUSES.has(commitment.status)) {
      if (!active.length) {
        missingTasks += 1;
        addIssue(issues, 'missing-active-task', 'high', commitment, terminal, 'Open the promise and create or restore one callback task after verifying the customer agreement.', terminal.length ? 'Only terminal callback attempts remain for an open promise.' : 'Open promise has no active callback task.');
      }
      if (active.length > 1) {
        duplicateTasks += active.length - 1;
        addIssue(issues, 'duplicate-active-tasks', 'high', commitment, active, 'Confirm the authoritative task and review duplicates before changing any records.', `${active.length} active callback tasks are linked to one promise.`);
      }
      if (active.length === 1) {
        const expected = expectedDueTimestamp(commitment), actual = Date.parse(active[0].dueAt || '');
        if (expected === null || !Number.isFinite(actual)) {
          dueDrift += 1; addIssue(issues, 'invalid-due-time-link', 'medium', commitment, active, 'Check the promise due date and callback task timestamp; retain the formal promise as the source of truth.', 'The linked task or promise has an invalid due time.');
        } else if (Math.abs(actual - expected) > 60_000) {
          dueDrift += 1; addIssue(issues, 'due-time-drift', 'medium', commitment, active, 'Use the recorded promise due date and time as the authoritative callback window.', 'Callback task dueAt differs from the promise by more than one minute.');
        }
      }
    }
    if (REVIEW_COMMITMENT_STATUSES.has(commitment.status) && active.length) {
      staleActiveTasks += active.length;
      addIssue(issues, 'review-hold-active-task', 'medium', commitment, active, 'Keep the promise under supervisor review; do not initiate another attempt until the review decision is recorded.', 'A callback task remains active while the promise is on independent review hold.');
    }
  }
  for (const [commitmentId, linked] of callbackGroups) if (!commitmentById.has(commitmentId)) {
    const active = linked.filter(row => ACTIVE_CALLBACK_STATUSES.has(row.status));
    if (active.length) { orphanTasks += active.length; addIssue(issues, 'orphan-active-task', 'medium', null, active, 'Check whether the promise was removed, migrated or linked incorrectly; do not delete the task automatically.', 'Active callback task points to a commitment that is not present.'); }
  }
  const severityRank = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.customer.localeCompare(b.customer) || a.type.localeCompare(b.type));
  return { version: '7.12.0', summary: {
    commitments: commitments.length, activeCommitments: activeCommitmentCount, callbackRecords: callbacks.length,
    activeCallbackTasks: callbacks.filter(row => ACTIVE_CALLBACK_STATUSES.has(row.status)).length, legacyUnlinked,
    missingTasks, duplicateTasks, orphanTasks, dueDrift, staleActiveTasks, closedWithActiveTasks,
    issueCount: issues.length, high: issues.filter(row => row.severity === 'high').length, medium: issues.filter(row => row.severity === 'medium').length
  }, issues: issues.slice(0, 40), truncated: issues.length > 40 };
}

export function renderCallbackIntegrityPanel(audit) {
  const result = audit && audit.summary ? audit : auditCallbackIntegrity(null, []), s = result.summary;
  const metric = (label, value, tone, note) => `<article class="metric-card callback-integrity-metric ${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
  const rows = result.issues.map(issue => {
    const badge = issue.severity === 'high' ? 'red' : issue.severity === 'medium' ? 'amber' : '';
    return `<tr><td><span class="pill ${badge}">${escapeHTML(issue.severity.toUpperCase())}</span><small>${escapeHTML(issue.type.replaceAll('-', ' '))}</small></td><td><strong>${escapeHTML(issue.customer)}</strong><small>${escapeHTML(issue.commitmentId || 'No linked promise ID')} · ${escapeHTML(issue.owner)}</small></td><td>${escapeHTML(issue.detail)}${issue.callbackIds.length ? `<small>Task(s): ${escapeHTML(issue.callbackIds.join(', '))}</small>` : ''}</td><td>${escapeHTML(issue.recommendation)}</td></tr>`;
  }).join('');
  const cleanState = s.issueCount === 0;
  return `<section class="panel callback-integrity-panel" aria-labelledby="callbackIntegrityHeading"><div class="panel-head"><div><div class="subtle-label">V7.12 · READ-ONLY RECONCILIATION</div><h3 id="callbackIntegrityHeading">Callback task integrity</h3><p>Checks the relationship between formal customer promises and their scheduled callback tasks.</p></div><span class="pill ${cleanState ? 'green' : s.high ? 'red' : 'amber'}">${cleanState ? 'NO LINK ERRORS' : `${s.issueCount} ITEMS TO REVIEW`}</span></div><div class="ops-summary-grid callback-integrity-metrics">${metric('ACTIVE PROMISES', s.activeCommitments, '', 'Formal promises still open or on hold')}${metric('ACTIVE TASKS', s.activeCallbackTasks, '', 'Scheduled, queued or in progress')}${metric('MISSING TASKS', s.missingTasks, s.missingTasks ? 'danger' : '', 'Open promises without an active task')}${metric('DUPLICATE TASKS', s.duplicateTasks, s.duplicateTasks ? 'danger' : '', 'Extra active tasks for one promise')}${metric('ORPHAN TASKS', s.orphanTasks, s.orphanTasks ? 'warning' : '', 'Tasks with no matching promise')}${metric('DUE-TIME DRIFT', s.dueDrift, s.dueDrift ? 'warning' : '', 'Task time differs from promise time')}</div>${cleanState ? '<div class="callback-integrity-clear"><strong>Promise and callback links are consistent.</strong><p>No missing, duplicated, orphaned or mismatched active tasks were found in this local simulation snapshot.</p></div>' : `<div class="table-wrap callback-integrity-table"><table><thead><tr><th>Severity / issue</th><th>Customer / owner</th><th>Evidence</th><th>Recommended review</th></tr></thead><tbody>${rows}</tbody></table></div>`}${result.truncated ? '<p class="muted-note">Showing the first 40 findings. Inspect the full saved records in the existing promise workspace.</p>' : ''}<p class="muted-note">${s.legacyUnlinked} legacy callback record(s) without a formal promise link are excluded from error counts. This audit is read-only: it does not create, delete, reschedule, reassign or close any callback task or customer promise.</p></section>`;
}
