import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCaseRecoveryPlan, renderCaseRecoveryPlanPanel } from '../js/case-recovery-planner-engine-v697.js';
import { transformCalloriaMainV697, calloriaCaseRecoveryPlannerPluginV697 } from '../build/calloria-case-recovery-planner-v6-97.mjs';
import { transformCalloriaMainV696 } from '../build/calloria-case-followup-workload-intelligence-v6-96.mjs';

function row(reference, overrides = {}) {
  const followUp = {
    id: `CFU-${reference}`,
    status: 'open',
    priority: 'normal',
    dueDay: 1,
    dueMinute: 600,
    owner: 'Agent One',
    claimedBy: '',
    attempts: 0,
    ...overrides.followUp
  };
  const caseRecord = {
    reference,
    customer: `Customer ${reference}`,
    title: `Issue ${reference}`,
    ...overrides.caseRecord
  };
  const risk = { state: 'on_track', deltaMinutes: 90, ...overrides.risk };
  return { caseRecord, followUp, risk };
}

const V696_FIXTURE = `/* __CALLORIA_CASE_FOLLOWUP_WORKLOAD_V696__ */
import { summariseCaseFollowUpWorkload, renderCaseFollowUpWorkloadPanel } from './case-followup-workload-engine-v696.js';
function renderCRM(){
  const followUpMetrics=caseFollowUpMetrics(state.cases,caseLifecycleClock());
  const caseFollowUpWorkload = summariseCaseFollowUpWorkload(followUpMetrics.rows);
  const followUpWorkloadPanel = renderCaseFollowUpWorkloadPanel(caseFollowUpWorkload, { escapeHTML, formatCaseClock });
  viewRoot.innerHTML=\`<div class="ops-summary-grid case-followup-metrics">x</div>\${followUpWorkloadPanel}<section class="panel case-followup-queue" style="margin-top:14px">worklist</section>\`;
}`;

test('empty or invalid input produces a zeroed plan', () => {
  const plan = buildCaseRecoveryPlan(null);
  assert.equal(plan.active, 0);
  assert.equal(plan.totalItems, 0);
  assert.deepEqual(plan.items, []);
  assert.equal(plan.hiddenItems, 0);
});

test('completed and malformed follow-ups are excluded', () => {
  const rows = [row('done', { followUp: { status: 'complete' } }), { followUp: 'invalid' }, row('active')];
  const plan = buildCaseRecoveryPlan(rows);
  assert.equal(plan.active, 1);
  assert.deepEqual(plan.items.map(item => item.reference), ['active']);
});

test('supervisor decisions rank before overdue and due-soon work', () => {
  const rows = [
    row('due', { risk: { state: 'due_soon', deltaMinutes: 7 } }),
    row('late', { risk: { state: 'overdue', deltaMinutes: -3 } }),
    row('review', { followUp: { status: 'supervisor_review' }, risk: { state: 'supervisor_review', deltaMinutes: null } })
  ];
  const plan = buildCaseRecoveryPlan(rows);
  assert.deepEqual(plan.items.map(item => item.reference), ['review', 'late', 'due']);
  assert.equal(plan.supervisorReview, 1);
  assert.equal(plan.overdue, 1);
  assert.equal(plan.dueWithin15, 1);
});

test('deadline boundaries classify due now, 15, 60 and 61 minutes correctly', () => {
  const plan = buildCaseRecoveryPlan([
    row('now', { risk: { state: 'on_track', deltaMinutes: 0 } }),
    row('fifteen', { risk: { state: 'due_soon', deltaMinutes: 15 } }),
    row('sixty', { risk: { state: 'on_track', deltaMinutes: 60 } }),
    row('sixty-one', { risk: { state: 'on_track', deltaMinutes: 61 } })
  ]);
  const buckets = Object.fromEntries(plan.items.map(item => [item.reference, item.bucket]));
  assert.deepEqual(buckets, { now: 'due_now', fifteen: 'due_15', sixty: 'due_60', 'sixty-one': 'scheduled' });
  assert.equal(plan.dueNow, 1);
  assert.equal(plan.dueWithin15, 2);
  assert.equal(plan.dueWithin60, 3);
});

test('overdue delta is retained even if the upstream risk label is inconsistent', () => {
  const plan = buildCaseRecoveryPlan([row('negative', { risk: { state: 'on_track', deltaMinutes: -2 } })]);
  assert.equal(plan.items[0].bucket, 'overdue');
  assert.equal(plan.overdue, 1);
});

test('unassigned and claim-state inconsistencies produce concrete next actions', () => {
  const plan = buildCaseRecoveryPlan([
    row('unassigned', { followUp: { owner: '' } }),
    row('missing-claimant', { followUp: { status: 'in_progress', claimedBy: '' } }),
    row('stale-claim', { followUp: { status: 'open', claimedBy: 'Agent Two' } })
  ]);
  const byRef = Object.fromEntries(plan.items.map(item => [item.reference, item.action]));
  assert.match(byRef.unassigned, /No named owner/);
  assert.match(byRef['missing-claimant'], /without a recorded claimant/);
  assert.match(byRef['stale-claim'], /stale claim/);
  assert.equal(plan.unassigned, 1);
  assert.equal(plan.ownershipFlags, 3);
});

test('off-shift and clock-unavailable states are separate from live SLA counts', () => {
  const plan = buildCaseRecoveryPlan([
    row('paused', { risk: { state: 'paused_off_shift', deltaMinutes: null } }),
    row('unknown', { risk: { state: 'clock_unavailable', deltaMinutes: null } })
  ]);
  assert.equal(plan.pausedOffShift, 1);
  assert.equal(plan.clockUnavailable, 1);
  assert.equal(plan.dueWithin15, 0);
  assert.match(plan.items.find(item => item.reference === 'paused').action, /paused off shift/);
});

test('plan generation does not mutate the supplied case rows', () => {
  const rows = [row('immutable'), row('late', { risk: { state: 'overdue', deltaMinutes: -5 } })];
  const before = structuredClone(rows);
  buildCaseRecoveryPlan(rows);
  assert.deepEqual(rows, before);
});

test('visible worklist is bounded and reports hidden item count', () => {
  const rows = Array.from({ length: 15 }, (_, index) => row(`R-${index + 1}`));
  const plan = buildCaseRecoveryPlan(rows, { limit: 6 });
  assert.equal(plan.items.length, 6);
  assert.equal(plan.hiddenItems, 9);
  assert.equal(plan.totalItems, 15);
  assert.equal(buildCaseRecoveryPlan(rows, { limit: 99 }).items.length, 12);
});

test('renderer escapes customer, case reference, title, owner and claimant values', () => {
  const html = renderCaseRecoveryPlanPanel(buildCaseRecoveryPlan([
    row('REF"><script>', {
      caseRecord: { customer: '<img src=x onerror=alert(1)>', title: '<script>bad()</script>' },
      followUp: { owner: 'A&B <Agent>', claimedBy: 'Handler "One"' },
      risk: { state: 'overdue', deltaMinutes: -11 }
    })
  ]));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;img/);
  assert.match(html, /A&amp;B &lt;Agent&gt;/);
  assert.match(html, /data-action="open-case-followup"/);
  assert.match(html, /OVERDUE/);
});

test('renderer produces accessible compact empty state', () => {
  const html = renderCaseRecoveryPlanPanel(buildCaseRecoveryPlan([]));
  assert.match(html, /aria-label="Case recovery action planner"/);
  assert.match(html, /No active reopened-case work/);
  assert.match(html, /Advisory only/);
});

test('plugin transforms only after v6.96 and adds the planner module and panel', () => {
  const transformed = transformCalloriaMainV697(V696_FIXTURE);
  assert.match(transformed, /__CALLORIA_CASE_RECOVERY_PLANNER_V697__/);
  assert.match(transformed, /case-recovery-planner-engine-v697\.js/);
  assert.match(transformed, /case-recovery-planner-v697\.css/);
  assert.match(transformed, /buildCaseRecoveryPlan\(followUpMetrics\.rows, \{ limit: 8 \}\)/);
  assert.match(transformed, /\$\{followUpWorkloadPanel\}\$\{caseRecoveryPlanPanel\}/);
});


test('v6.96 and v6.97 transforms compose in order on the CRM baseline fixture', () => {
  const caseImport = "import { normalizeCaseLifecycle, caseReopenEligibility, reopenCase, caseFollowUpRisk, startCaseFollowUp, completeCaseFollowUp, reviewCaseFollowUp, caseFollowUpMetrics, formatCaseClock } from './case-lifecycle-engine.js';";
  const baseline = `${caseImport}
function renderCRM(){
  const followUpMetrics=caseFollowUpMetrics(state.cases,caseLifecycleClock());
  viewRoot.innerHTML=\`<div class="ops-summary-grid case-followup-metrics">cards</div><section class="panel case-followup-queue" style="margin-top:14px">worklist</section>\`;
}`;
  const v696 = transformCalloriaMainV696(baseline);
  const v697 = transformCalloriaMainV697(v696);
  assert.match(v697, /__CALLORIA_CASE_FOLLOWUP_WORKLOAD_V696__/);
  assert.match(v697, /__CALLORIA_CASE_RECOVERY_PLANNER_V697__/);
  assert.match(v697, /\$\{followUpWorkloadPanel\}\$\{caseRecoveryPlanPanel\}/);
  assert.equal((v697.match(/case-recovery-planner-engine-v697\.js/g) || []).length, 1);
});

test('combined v6.96/v6.97 transformed fixture passes Node syntax validation', async () => {
  const caseImport = "import { normalizeCaseLifecycle, caseReopenEligibility, reopenCase, caseFollowUpRisk, startCaseFollowUp, completeCaseFollowUp, reviewCaseFollowUp, caseFollowUpMetrics, formatCaseClock } from './case-lifecycle-engine.js';";
  const baseline = `${caseImport}
function renderCRM(){
  const followUpMetrics=caseFollowUpMetrics(state.cases,caseLifecycleClock());
  viewRoot.innerHTML=\`<div class="ops-summary-grid case-followup-metrics">cards</div><section class="panel case-followup-queue" style="margin-top:14px">worklist</section>\`;
}`;
  const transformed = transformCalloriaMainV697(transformCalloriaMainV696(baseline));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'calloria-v697-'));
  const file = path.join(directory, 'transformed-main.js');
  try {
    await writeFile(file, transformed, 'utf8');
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout || ''}${result.stderr || ''}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('plugin is idempotent', () => {
  const once = transformCalloriaMainV697(V696_FIXTURE);
  assert.equal(transformCalloriaMainV697(once), once);
});

test('missing v6.96 transform fails clearly without returning partial source', () => {
  assert.throws(() => transformCalloriaMainV697('function renderCRM(){}'), /requires the v6\.96/);
});

test('source drift at a required v6.96 anchor fails closed', () => {
  const broken = V696_FIXTURE.replace('const followUpWorkloadPanel = renderCaseFollowUpWorkloadPanel(caseFollowUpWorkload, { escapeHTML, formatCaseClock });', 'const changedPanel = true;');
  assert.throws(() => transformCalloriaMainV697(broken), /v6\.96 workload import anchor|CRM recovery-plan render anchor/);
});

test('Vite plugin is scoped to main.js and exposes source errors through Vite context', () => {
  const plugin = calloriaCaseRecoveryPlannerPluginV697();
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.transform.call({ error(message) { throw new Error(message); } }, V696_FIXTURE, '/repo/js/other.js'), null);
  const output = plugin.transform.call({ error(message) { throw new Error(message); } }, V696_FIXTURE, '/repo/js/main.js');
  assert.match(output.code, /__CALLORIA_CASE_RECOVERY_PLANNER_V697__/);
  assert.equal(output.map, null);
  assert.throws(() => plugin.transform.call({ error(message) { throw new Error(message); } }, 'export{}', '/repo/js/main.js'), /requires the v6\.96/);
});
