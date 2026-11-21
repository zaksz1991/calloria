import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  summariseCaseFollowUpWorkload,
  renderCaseFollowUpWorkloadPanel
} from '../js/case-followup-workload-engine-v696.js';
import {
  transformCalloriaMainV696,
  calloriaCaseFollowUpWorkloadIntelligencePluginV696
} from '../build/calloria-case-followup-workload-intelligence-v6-96.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = await readFile(path.join(root, 'tests/fixtures/main-before-v696.js'), 'utf8');

function row(reference, owner, overrides = {}) {
  const followUp = {
    id: `FU-${reference}`,
    status: 'open',
    priority: 'normal',
    dueDay: 2,
    dueMinute: 600,
    owner,
    claimedBy: '',
    ...overrides
  };
  return {
    caseRecord: { reference, customer: 'Synthetic customer' },
    followUp,
    risk: { state: 'on_track' }
  };
}

test('empty or invalid input produces a zeroed workload snapshot', () => {
  const result = summariseCaseFollowUpWorkload(null);
  assert.equal(result.open, 0);
  assert.equal(result.ownerCount, 0);
  assert.equal(result.unassigned, 0);
  assert.deepEqual(result.owners, []);
  assert.deepEqual(result.exceptions, []);
});

test('completed or malformed follow-ups are excluded', () => {
  const result = summariseCaseFollowUpWorkload([
    null,
    { followUp: null },
    row('DONE', 'Agent A', { status: 'complete' })
  ]);
  assert.equal(result.open, 0);
  assert.equal(result.ownerCount, 0);
});

test('cases are grouped by owner without mutating original records', () => {
  const rows = [row('A', 'Agent One'), row('B', 'agent one'), row('C', 'Agent Two')];
  const before = JSON.stringify(rows);
  const result = summariseCaseFollowUpWorkload(rows);
  assert.equal(result.ownerCount, 2);
  assert.equal(result.owners.find(item => item.owner === 'Agent One').open, 2);
  assert.equal(JSON.stringify(rows), before);
});

test('urgent, overdue, due-soon, in-progress and supervisor-review counts are accurate', () => {
  const rows = [
    row('URG', 'Agent A', { priority: 'urgent' }),
    { ...row('LATE', 'Agent A'), risk: { state: 'overdue' } },
    { ...row('SOON', 'Agent B'), risk: { state: 'due_soon' } },
    row('WORK', 'Agent B', { status: 'in_progress', claimedBy: 'Agent B' }),
    row('REVIEW', 'Agent C', { status: 'supervisor_review', claimedBy: 'Agent A' })
  ];
  const result = summariseCaseFollowUpWorkload(rows);
  assert.equal(result.open, 5);
  assert.equal(result.urgent, 1);
  assert.equal(result.overdue, 1);
  assert.equal(result.dueSoon, 1);
  assert.equal(result.inProgress, 1);
  assert.equal(result.supervisorReview, 1);
  assert.equal(result.owners[0].exposure, 'SUPERVISOR REVIEW');
});

test('missing owner and inconsistent claim-state metadata are flagged', () => {
  const result = summariseCaseFollowUpWorkload([
    row('NO-OWNER', '  '),
    row('NO-CLAIMANT', 'Agent B', { status: 'in_progress', claimedBy: '' }),
    row('STALE-CLAIM', 'Agent C', { status: 'open', claimedBy: 'Agent C' })
  ]);
  assert.equal(result.unassigned, 1);
  assert.equal(result.claimIntegrityFlags, 2);
  assert.equal(result.ownerCount, 2);
  assert.equal(result.exceptions.length, 3);
  assert.deepEqual(new Set(result.exceptions.map(issue => issue.type)), new Set(['missing_owner', 'missing_claimant', 'stale_claim']));
});

test('next due deadline selects the earliest simulated day and minute', () => {
  const result = summariseCaseFollowUpWorkload([
    row('LATER', 'Agent A', { dueDay: 4, dueMinute: 300 }),
    row('EARLIER', 'Agent A', { dueDay: 2, dueMinute: 800 })
  ]);
  assert.equal(result.owners[0].nextDueDay, 2);
  assert.equal(result.owners[0].nextDueMinute, 800);
});

test('owner groups sort by exposure before raw case volume', () => {
  const result = summariseCaseFollowUpWorkload([
    row('MONITOR', 'Agent A'),
    { ...row('OVERDUE', 'Agent B'), risk: { state: 'overdue' } },
    row('REVIEW', 'Agent C', { status: 'supervisor_review' })
  ]);
  assert.deepEqual(result.owners.map(item => item.owner), ['Agent C', 'Agent B', 'Agent A']);
});

test('renderer escapes owner, handler and case references', () => {
  const result = summariseCaseFollowUpWorkload([
    row('<img src=x>', 'Agent <script>', { status: 'in_progress', claimedBy: '<b>Handler</b>' })
  ]);
  const html = renderCaseFollowUpWorkloadPanel(result);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;Handler&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img/);
});

test('renderer provides a compact empty state and integrity explanation', () => {
  const html = renderCaseFollowUpWorkloadPanel(summariseCaseFollowUpWorkload([]));
  assert.match(html, /No active follow-up ownership/);
  assert.match(html, /Ownership integrity checks/);
  assert.match(html, /No case is reassigned/);
});

test('main transform injects module, styles, workload model and visible CRM panel', () => {
  const transformed = transformCalloriaMainV696(fixture);
  assert.match(transformed, /case-followup-workload-engine-v696\.js/);
  assert.match(transformed, /case-followup-workload-v696\.css/);
  assert.match(transformed, /summariseCaseFollowUpWorkload\(followUpMetrics\.rows\)/);
  assert.match(transformed, /\$\{followUpWorkloadPanel\}<section class="panel case-followup-queue"/);
});

test('main transform is idempotent', () => {
  const once = transformCalloriaMainV696(fixture);
  const twice = transformCalloriaMainV696(once);
  assert.equal(twice, once);
});

test('source drift fails closed at each required anchor', () => {
  assert.throws(() => transformCalloriaMainV696(fixture.replace("from './case-lifecycle-engine.js';", "from './different-engine.js';")), /case lifecycle import anchor/);
  assert.throws(() => transformCalloriaMainV696(fixture.replace('const followUpMetrics=caseFollowUpMetrics(state.cases,caseLifecycleClock());', 'const metrics = [];')), /CRM follow-up metrics anchor/);
  assert.throws(() => transformCalloriaMainV696(fixture.replace('class="panel case-followup-queue"', 'class="panel renamed-queue"')), /CRM follow-up panel insertion anchor/);
});

test('Vite plugin transforms only js/main.js and reports source drift through Vite context', () => {
  const plugin = calloriaCaseFollowUpWorkloadIntelligencePluginV696();
  const ignored = plugin.transform.call({ error(message) { throw new Error(message); } }, fixture, '/app/js/other.js');
  assert.equal(ignored, null);
  const transformed = plugin.transform.call({ error(message) { throw new Error(message); } }, fixture, '/app/js/main.js');
  assert.match(transformed.code, /__CALLORIA_CASE_FOLLOWUP_WORKLOAD_V696__/);
  assert.throws(() => plugin.transform.call({ error(message) { throw new Error(message); } }, 'export const x=1;', '/app/js/main.js'), /source rebase failed/);
});

test('transformed fixture passes Node syntax validation', async () => {
  const transformed = transformCalloriaMainV696(fixture);
  const tempFile = path.join(root, 'tests/.transformed-main-v696.mjs');
  const fs = await import('node:fs/promises');
  await fs.writeFile(tempFile, transformed, 'utf8');
  const checked = spawnSync(process.execPath, ['--check', tempFile], { encoding: 'utf8' });
  await fs.rm(tempFile, { force: true });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
});

test('mobile workload table remains horizontally scrollable with compact cards', async () => {
  const css = await readFile(path.join(root, 'js/case-followup-workload-v696.css'), 'utf8');
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /min-width:780px/);
  assert.match(css, /@media\(max-width:700px\)/);
});
