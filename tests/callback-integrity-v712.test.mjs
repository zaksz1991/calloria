import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCallbackIntegrity, renderCallbackIntegrityPanel } from '../js/callback-integrity-engine-v712.js';
import { calloriaCallbackIntegrityPluginV712 } from '../build/calloria-callback-integrity-v712-plugin.mjs';

const dueAt = new Date(2026, 10, 23, 10, 0, 0, 0).toISOString();
const promise = (overrides = {}) => ({ id: 'CB-1', customerId: 'C-1', customerName: 'Amina', owner: 'Agent A', status: 'Open', dueDate: '2026-11-23', dueMinutes: 600, ...overrides });
const callback = (overrides = {}) => ({ id: 'TASK-1', commitmentId: 'CB-1', customer: 'Amina', status: 'scheduled', dueAt, ...overrides });
const state = commitments => ({ commitments });

test('clean one-to-one promise/task pair has no issues', () => {
  const result = auditCallbackIntegrity(state([promise()]), [callback()]);
  assert.equal(result.summary.issueCount, 0);
  assert.equal(result.summary.activeCommitments, 1);
});
test('open promise without active callback task is flagged', () => {
  const result = auditCallbackIntegrity(state([promise()]), []);
  assert.equal(result.summary.missingTasks, 1);
  assert.equal(result.issues[0].type, 'missing-active-task');
});
test('terminal callback does not satisfy an open promise', () => {
  const result = auditCallbackIntegrity(state([promise()]), [callback({ status: 'completed' })]);
  assert.equal(result.summary.missingTasks, 1);
  assert.match(result.issues[0].detail, /terminal callback/i);
});
test('duplicate active callback tasks are detected', () => {
  const result = auditCallbackIntegrity(state([promise()]), [callback(), callback({ id: 'TASK-2', status: 'queued' })]);
  assert.equal(result.summary.duplicateTasks, 1);
  assert.ok(result.issues.some(issue => issue.type === 'duplicate-active-tasks'));
});
test('active callback whose promise is absent is orphaned', () => {
  const result = auditCallbackIntegrity(state([]), [callback()]);
  assert.equal(result.summary.orphanTasks, 1);
  assert.ok(result.issues.some(issue => issue.type === 'orphan-active-task'));
});
test('active task attached to completed promise is flagged', () => {
  const result = auditCallbackIntegrity(state([promise({ status: 'Complete' })]), [callback()]);
  assert.equal(result.summary.closedWithActiveTasks, 1);
  assert.ok(result.issues.some(issue => issue.type === 'closed-promise-active-task'));
});
test('task due time drift is flagged', () => {
  const result = auditCallbackIntegrity(state([promise()]), [callback({ dueAt: new Date(new Date(dueAt).getTime() + 5 * 60_000).toISOString() })]);
  assert.equal(result.summary.dueDrift, 1);
  assert.ok(result.issues.some(issue => issue.type === 'due-time-drift'));
});
test('one-minute due timestamp tolerance is accepted', () => {
  const result = auditCallbackIntegrity(state([promise()]), [callback({ dueAt: new Date(new Date(dueAt).getTime() + 30_000).toISOString() })]);
  assert.equal(result.summary.dueDrift, 0);
  assert.equal(result.summary.issueCount, 0);
});
test('review-hold promise does not require an active callback task', () => {
  const result = auditCallbackIntegrity(state([promise({ status: 'Needs review' })]), []);
  assert.equal(result.summary.missingTasks, 0);
  assert.equal(result.summary.issueCount, 0);
});
test('review-hold promise with an active task is warned, not treated as a new attempt', () => {
  const result = auditCallbackIntegrity(state([promise({ status: 'Needs review' })]), [callback()]);
  assert.equal(result.summary.staleActiveTasks, 1);
  assert.ok(result.issues.some(issue => issue.type === 'review-hold-active-task'));
});
test('legacy callbacks without a commitment link are counted but not treated as errors', () => {
  const result = auditCallbackIntegrity(state([]), [{ id: 'LEGACY-1', status: 'scheduled' }]);
  assert.equal(result.summary.legacyUnlinked, 1);
  assert.equal(result.summary.issueCount, 0);
});
test('duplicate promise IDs are detected', () => {
  const result = auditCallbackIntegrity(state([promise(), promise({ customerName: 'Other' })]), [callback()]);
  assert.ok(result.issues.some(issue => issue.type === 'duplicate-commitment-id'));
});
test('malformed input is handled without throwing', () => {
  const result = auditCallbackIntegrity(null, null);
  assert.equal(result.summary.issueCount, 0);
});
test('audit does not mutate commitment or callback input', () => {
  const commitments = [promise()], callbacks = [callback()];
  const before = JSON.stringify({ commitments, callbacks });
  auditCallbackIntegrity(state(commitments), callbacks);
  assert.equal(JSON.stringify({ commitments, callbacks }), before);
});
test('rendered panel escapes customer-controlled values', () => {
  const result = auditCallbackIntegrity(state([promise({ customerName: '<img src=x onerror=alert(1)>' })]), []);
  const html = renderCallbackIntegrityPanel(result);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
});
test('Vite plugin injects imports and integrity panel into current Promise Control source', () => {
  const source = [
    'function renderPromiseControl(){',
    ' const dashboard=PromiseControlEngine.buildPortfolio(commitmentStore(),commitmentShiftSnapshot(),state.callbacks,state.supervisorRequests);',
    ' const metrics=dashboard.metrics;',
    ' viewRoot.innerHTML=`',
    '     <div class="ops-summary-grid promise-control-metrics">',
    '     `;',
    '}'
  ].join('\n');
  const plugin = calloriaCallbackIntegrityPluginV712();
  const result = plugin.transform.call({ warn(message) { throw new Error(message); } }, source, '/repo/js/main.js');
  assert.ok(result.code.includes("from './callback-integrity-engine-v712.js'"));
  assert.ok(result.code.includes("import '../styles/calloria-callback-integrity-v712.css';"));
  assert.ok(result.code.includes('${__calloriaCallbackIntegrityPanel}'));
  assert.ok(result.code.includes('__CALLORIA_CALLBACK_INTEGRITY_V712__'));
});
test('Vite plugin safely skips when source anchors drift', () => {
  let warning = '';
  const plugin = calloriaCallbackIntegrityPluginV712();
  const result = plugin.transform.call({ warn(message) { warning = message; } }, 'function renderPromiseControl(){}', '/repo/js/main.js');
  assert.equal(result, null);
  assert.match(warning, /skipped safely/);
});
