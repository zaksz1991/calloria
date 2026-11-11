import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/voice-of-customer-engine.js');

function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    dump(key) { return JSON.parse(data.get(key) || 'null'); }
  };
}
function validFeedback(overrides = {}) {
  return { customerId: 'CUS-1234', contactRef: 'CT-1234', caseId: 'CASE-1234', channel: 'Email', productId: 'general', theme: 'Communication', csat: 4, nps: 9, ces: 4, comment: 'The agent explained the next steps clearly.', ...overrides };
}

 test('version and storage keys are stable', () => {
  assert.equal(E.VERSION, '5.6.0');
  assert.equal(E.STORAGE_KEY, 'calloria.voice-of-customer.v56');
  assert.equal(E.WORKBENCH_KEY, 'calloria.agent-workbench.v55');
  assert.equal(E.CUSTOMER_KEY, 'calloria.customer-journey.v54');
});

test('initial state includes labelled sample responses and recovery tasks', () => {
  const state = E.createInitialState('2026-11-11T12:00:00.000Z');
  assert.equal(state.feedback.length, 6);
  assert.ok(state.feedback.every((item) => item.demo === true));
  assert.equal(state.recoveryTasks.length, 2);
  assert.ok(state.recoveryTasks.every((item) => item.status === 'Open'));
});

test('normalise protects all register arrays from malformed values', () => {
  const state = E.normaliseState({ feedback: null, invitations: {}, recoveryTasks: null, activity: 'bad' }, '2026-11-11T00:00:00Z');
  assert.ok(Array.isArray(state.feedback));
  assert.ok(Array.isArray(state.invitations));
  assert.ok(Array.isArray(state.recoveryTasks));
  assert.ok(Array.isArray(state.activity));
});

test('load returns a valid fresh state with empty storage', () => {
  const state = E.load(fakeStorage(), '2026-11-11T00:00:00Z');
  assert.equal(state.version, '5.6.0');
  assert.equal(state.feedback.length, 6);
});

test('load safely recovers from malformed saved JSON', () => {
  const storage = fakeStorage({ [E.STORAGE_KEY]: '{invalid' });
  const state = E.load(storage, '2026-11-11T00:00:00Z');
  assert.equal(state.feedback.length, 6);
});

test('save persists state to the declared browser key', () => {
  const storage = fakeStorage();
  const state = E.createInitialState('2026-11-11T00:00:00Z');
  assert.equal(E.save(state, storage), true);
  assert.equal(storage.dump(E.STORAGE_KEY).version, '5.6.0');
});

test('save reports unavailable storage', () => {
  assert.equal(E.save(E.createInitialState(), null), false);
});

test('NPS grouping uses promoter, passive and detractor boundaries', () => {
  assert.equal(E.npsGroup(10), 'Promoter');
  assert.equal(E.npsGroup(9), 'Promoter');
  assert.equal(E.npsGroup(8), 'Passive');
  assert.equal(E.npsGroup(7), 'Passive');
  assert.equal(E.npsGroup(6), 'Detractor');
  assert.equal(E.npsGroup(0), 'Detractor');
});

test('recovery threshold catches low CSAT, detractor NPS and difficult CES', () => {
  assert.equal(E.isRecoveryRequired({ csat: 2, nps: 9, ces: 5 }), true);
  assert.equal(E.isRecoveryRequired({ csat: 4, nps: 6, ces: 4 }), true);
  assert.equal(E.isRecoveryRequired({ csat: 4, nps: 9, ces: 2 }), true);
  assert.equal(E.isRecoveryRequired({ csat: 3, nps: 7, ces: 3 }), false);
});

test('feedback validation accepts a complete valid record', () => {
  const fields = E.validateFeedback(validFeedback());
  assert.equal(fields.csat, 4);
  assert.equal(fields.nps, 9);
  assert.equal(fields.ces, 4);
  assert.equal(fields.channel, 'Email');
});

test('feedback validation rejects missing payload', () => {
  assert.throws(() => E.validateFeedback(null), /required/);
});

test('feedback validation rejects invalid CSAT values', () => {
  for (const value of [0, 6, 2.5, 'five', null]) assert.throws(() => E.validateFeedback(validFeedback({ csat: value })), /CSAT/);
});

test('feedback validation rejects invalid NPS values', () => {
  for (const value of [-1, 11, 4.5, 'nine']) assert.throws(() => E.validateFeedback(validFeedback({ nps: value })), /NPS/);
});

test('feedback validation rejects invalid customer effort values', () => {
  for (const value of [0, 6, 2.2]) assert.throws(() => E.validateFeedback(validFeedback({ ces: value })), /Customer effort/);
});

test('feedback validation rejects unsupported channel and product', () => {
  assert.throws(() => E.validateFeedback(validFeedback({ channel: 'Pager' })), /channel/);
  assert.throws(() => E.validateFeedback(validFeedback({ productId: 'unknown-product' })), /product/);
});

test('feedback validation rejects unsupported theme', () => {
  assert.throws(() => E.validateFeedback(validFeedback({ theme: 'Invented theme' })), /theme/);
});

test('feedback validation requires a meaningful comment', () => {
  assert.throws(() => E.validateFeedback(validFeedback({ comment: 'no' })), /at least five/);
});

test('feedback validation sanitises markup and control characters', () => {
  const fields = E.validateFeedback(validFeedback({ comment: '<b>Helpful</b>\nanswer\u0000 received.' }));
  assert.equal(fields.comment.includes('<'), false);
  assert.equal(fields.comment.includes('\n'), false);
});

test('feedback validation checks customer reference format', () => {
  assert.throws(() => E.validateFeedback(validFeedback({ customerId: 'CUS/1234' })), /customer reference/);
});

test('completed contact import creates one invitation with linked customer and case', () => {
  const state = E.createInitialState('2026-11-11T12:00:00Z');
  const workbench = { contacts: [{ id: 'CT-X', reference: 'CT-X', customerId: 'CUS-X', caseId: 'CASE-X', channel: 'Voice', productId: 'kano-run', subject: 'Login issue', status: 'Completed', completedAt: '2026-11-11T10:00:00Z', wrapUp: { linkedCaseId: 'CASE-X' } }] };
  const rows = E.importCompletedContacts(state, workbench, '2026-11-11T12:01:00Z');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].customerId, 'CUS-X');
  assert.equal(rows[0].caseId, 'CASE-X');
  assert.equal(rows[0].channel, 'Voice');
  assert.equal(rows[0].productId, 'kano-run');
  assert.equal(rows[0].status, 'Ready to record');
});

test('contact import ignores non-completed contacts', () => {
  const state = E.createInitialState();
  const rows = E.importCompletedContacts(state, { contacts: [{ id: 'A', status: 'Queued' }, { id: 'B', status: 'Active' }] }, '2026-11-11T12:00:00Z');
  assert.equal(rows.length, 0);
});

test('contact import is idempotent across repeated runs', () => {
  const state = E.createInitialState();
  const source = { contacts: [{ id: 'X-1', reference: 'X-1', customerId: 'CUS-X', status: 'Completed' }] };
  E.importCompletedContacts(state, source, '2026-11-11T12:00:00Z');
  const second = E.importCompletedContacts(state, source, '2026-11-11T12:05:00Z');
  assert.equal(second.length, 0);
  assert.equal(state.invitations.length, 1);
});

test('import from storage reads v5.5 workbench data', () => {
  const storage = fakeStorage({ [E.WORKBENCH_KEY]: { contacts: [{ id: 'Y-1', status: 'Completed', customerId: 'CUS-Y' }] } });
  const state = E.createInitialState();
  const rows = E.importFromStorage(state, storage, '2026-11-11T12:00:00Z');
  assert.equal(rows.length, 1);
});

test('import from storage reports inaccessible storage', () => {
  assert.throws(() => E.importFromStorage(E.createInitialState(), null), /unavailable/);
});

test('manual feedback is recorded and does not create recovery when scores are healthy', () => {
  const state = E.createInitialState();
  const before = state.recoveryTasks.length;
  const item = E.createFeedback(state, validFeedback(), '2026-11-11T12:00:00Z');
  assert.ok(item.reference.startsWith('VOC-2026-'));
  assert.equal(item.promoterGroup, 'Promoter');
  assert.equal(state.recoveryTasks.length, before);
});

test('low customer scores automatically create a 24-hour recovery task', () => {
  const state = E.createInitialState();
  const before = state.recoveryTasks.length;
  const at = '2026-11-11T12:00:00.000Z';
  const item = E.createFeedback(state, validFeedback({ csat: 1, nps: 2, ces: 1 }), at);
  const task = E.getRecoveryTask(state, item.recoveryTaskId);
  assert.equal(state.recoveryTasks.length, before + 1);
  assert.equal(task.status, 'Open');
  assert.equal(task.priority, 'Urgent');
  assert.equal(new Date(task.dueAt).getTime() - new Date(at).getTime(), 24 * 3600000);
});

test('NPS detractor alone creates a recovery task even with high CSAT', () => {
  const state = E.createInitialState();
  const item = E.createFeedback(state, validFeedback({ csat: 5, nps: 6, ces: 5 }), '2026-11-11T12:00:00Z');
  assert.ok(item.recoveryTaskId);
});

test('difficult effort alone creates a recovery task', () => {
  const state = E.createInitialState();
  const item = E.createFeedback(state, validFeedback({ csat: 5, nps: 9, ces: 1 }), '2026-11-11T12:00:00Z');
  assert.ok(item.recoveryTaskId);
});

test('invitation feedback inherits channel, product, customer and case links', () => {
  const state = E.createInitialState();
  const invitation = E.importCompletedContacts(state, { contacts: [{ id: 'Z-1', reference: 'Z-1', customerId: 'CUS-Z', status: 'Completed', channel: 'Live chat', productId: 'ruffneck-lms', wrapUp: { linkedCaseId: 'CASE-Z' } }] }, '2026-11-11T12:00:00Z')[0];
  const item = E.createFeedback(state, { invitationId: invitation.id, csat: 4, nps: 8, ces: 4, theme: 'Communication', comment: 'Clear explanation of the next step.' }, '2026-11-11T12:10:00Z');
  assert.equal(item.customerId, 'CUS-Z');
  assert.equal(item.channel, 'Live chat');
  assert.equal(item.productId, 'ruffneck-lms');
  assert.equal(item.caseId, 'CASE-Z');
  assert.equal(invitation.status, 'Feedback recorded');
});

test('invitation cannot be recorded twice', () => {
  const state = E.createInitialState();
  const invitation = E.importCompletedContacts(state, { contacts: [{ id: 'Z-2', status: 'Completed' }] })[0];
  const input = { invitationId: invitation.id, csat: 4, nps: 8, ces: 4, theme: 'Other', comment: 'A complete feedback response.' };
  E.createFeedback(state, input);
  assert.throws(() => E.createFeedback(state, input), /already been recorded/);
});

test('feedback rejects unknown invitation identifiers', () => {
  assert.throws(() => E.createFeedback(E.createInitialState(), validFeedback({ invitationId: 'missing' })), /not found/);
});

test('recovery task creation is idempotent per feedback item', () => {
  const state = E.createInitialState();
  const item = state.feedback[0];
  const count = state.recoveryTasks.length;
  const one = E.createRecoveryTask(state, item, '2026-11-11T12:00:00Z');
  const two = E.createRecoveryTask(state, item, '2026-11-11T12:01:00Z');
  assert.equal(one.id, two.id);
  assert.equal(state.recoveryTasks.length, count);
});

test('recovery update rejects unknown task', () => {
  assert.throws(() => E.updateRecoveryTask(E.createInitialState(), 'missing', { status: 'Open' }), /not found/);
});

test('recovery update rejects unsupported status', () => {
  const state = E.createInitialState();
  assert.throws(() => E.updateRecoveryTask(state, state.recoveryTasks[0].id, { status: 'Ignored' }), /valid recovery status/);
});

test('recovery assignment requires an accountable owner', () => {
  const state = E.createInitialState();
  assert.throws(() => E.updateRecoveryTask(state, state.recoveryTasks[0].id, { status: 'Assigned', owner: ' ' }), /Assign an owner/);
});

test('recovery task can be assigned and moved to in progress', () => {
  const state = E.createInitialState();
  const task = E.updateRecoveryTask(state, state.recoveryTasks[0].id, { status: 'In progress', owner: 'Team Lead', note: 'Customer callback scheduled.' }, '2026-11-11T13:00:00Z');
  assert.equal(task.status, 'In progress');
  assert.equal(task.owner, 'Team Lead');
  assert.equal(task.updates.length, 1);
});

test('recovery task cannot be resolved without a sufficient outcome', () => {
  const state = E.createInitialState();
  assert.throws(() => E.updateRecoveryTask(state, state.recoveryTasks[0].id, { status: 'Resolved', owner: 'Team Lead', resolution: 'done' }), /at least 10 characters/);
});

test('recovery task can be resolved with a documented outcome', () => {
  const state = E.createInitialState();
  const task = E.updateRecoveryTask(state, state.recoveryTasks[0].id, { status: 'Resolved', owner: 'Team Lead', resolution: 'Customer contacted and the open issue was corrected.' }, '2026-11-11T13:00:00Z');
  assert.equal(task.status, 'Resolved');
  assert.match(task.resolution, /Customer contacted/);
});

test('recovery task history is retained on each update', () => {
  const state = E.createInitialState();
  const task = state.recoveryTasks[0];
  E.updateRecoveryTask(state, task.id, { status: 'Assigned', owner: 'Supervisor' });
  E.updateRecoveryTask(state, task.id, { status: 'In progress', owner: 'Supervisor', note: 'Investigation started.' });
  assert.equal(task.updates.length, 2);
});

test('score metrics calculate CSAT, satisfaction percentage, NPS and CES', () => {
  const metrics = E.scoreMetrics([
    { csat: 5, nps: 10, ces: 5 }, { csat: 3, nps: 8, ces: 3 }, { csat: 1, nps: 2, ces: 1 }, { csat: 4, nps: 9, ces: 4 }
  ]);
  assert.equal(metrics.responses, 4);
  assert.equal(metrics.csatAverage, 3.25);
  assert.equal(metrics.csatSatisfiedPct, 50);
  assert.equal(metrics.nps, 25);
  assert.equal(metrics.cesAverage, 3.25);
  assert.equal(metrics.promoters, 2);
  assert.equal(metrics.passives, 1);
  assert.equal(metrics.detractors, 1);
});

test('score metrics handle an empty response register', () => {
  const metrics = E.scoreMetrics([]);
  assert.equal(metrics.responses, 0);
  assert.equal(metrics.nps, null);
  assert.equal(metrics.csatAverage, null);
});

test('group counts produce theme and channel totals', () => {
  const counts = E.groupCounts([{ theme: 'A' }, { theme: 'B' }, { theme: 'A' }], 'theme');
  assert.deepEqual(counts, { A: 2, B: 1 });
});

test('dashboard separates open and overdue recovery tasks', () => {
  const state = E.createInitialState('2026-11-11T12:00:00Z');
  state.recoveryTasks[0].dueAt = '2026-11-10T00:00:00Z';
  state.recoveryTasks[1].status = 'Resolved';
  const dashboard = E.getDashboard(state, '2026-11-11T12:00:00Z');
  assert.equal(dashboard.openRecovery, 1);
  assert.equal(dashboard.overdueRecovery, 1);
  assert.equal(dashboard.responses, 6);
});

test('channel dashboard returns sorted sample counts', () => {
  const dashboard = E.getDashboard(E.createInitialState('2026-11-11T12:00:00Z'), '2026-11-11T12:00:00Z');
  assert.ok(dashboard.channels.length > 0);
  assert.ok(dashboard.channels[0].count >= dashboard.channels[dashboard.channels.length - 1].count);
});

test('read workbench safely reads the integration source', () => {
  const storage = fakeStorage({ [E.WORKBENCH_KEY]: { contacts: [] } });
  assert.deepEqual(E.readWorkbench(storage), { contacts: [] });
});

test('read workbench returns null for malformed input', () => {
  assert.equal(E.readWorkbench(fakeStorage({ [E.WORKBENCH_KEY]: '{bad' })), null);
});

test('read Customer 360 safely reads v5.4 storage', () => {
  const storage = fakeStorage({ [E.CUSTOMER_KEY]: { cases: [] } });
  assert.deepEqual(E.readCustomerJourney(storage), { cases: [] });
});

test('case satisfaction sync requires a linked case', () => {
  const state = E.createInitialState();
  const item = E.createFeedback(state, validFeedback({ caseId: '' }), '2026-11-11T12:00:00Z');
  assert.throws(() => E.syncCaseSatisfaction(state, item.id, fakeStorage()), /not linked/);
});

test('case satisfaction sync rejects unavailable v5.4 storage', () => {
  const state = E.createInitialState();
  const item = state.feedback[0];
  assert.throws(() => E.syncCaseSatisfaction(state, item.id, fakeStorage()), /not found/);
});

test('case satisfaction sync attaches the feedback to the matching case record', () => {
  const state = E.createInitialState();
  const item = state.feedback[0];
  const storage = fakeStorage({ [E.CUSTOMER_KEY]: { cases: [{ id: 'CASE-54001', reference: 'CASE-54001', timeline: [] }] } });
  const record = E.syncCaseSatisfaction(state, item.id, storage, '2026-11-11T15:00:00Z');
  assert.equal(record.satisfaction.feedbackId, item.id);
  assert.equal(record.satisfaction.csat, item.csat);
  assert.equal(record.satisfactionHistory.length, 1);
  assert.equal(record.timeline[0].type, 'customer-feedback');
});

test('case satisfaction sync does not duplicate the same history item or timeline event', () => {
  const state = E.createInitialState();
  const item = state.feedback[0];
  const storage = fakeStorage({ [E.CUSTOMER_KEY]: { cases: [{ id: 'CASE-54001', timeline: [], satisfactionHistory: [] }] } });
  E.syncCaseSatisfaction(state, item.id, storage, '2026-11-11T15:00:00Z');
  E.syncCaseSatisfaction(state, item.id, storage, '2026-11-11T15:05:00Z');
  const record = storage.dump(E.CUSTOMER_KEY).cases[0];
  assert.equal(record.satisfactionHistory.length, 1);
  assert.equal(record.timeline.length, 1);
});

test('CSV export includes feedback labels and sample marker', () => {
  const csv = E.exportFeedbackCsv(E.createInitialState());
  assert.match(csv, /CSAT \/ 5/);
  assert.match(csv, /Demonstration sample/);
  assert.match(csv, /VOC-56001/);
});

test('CSV export quotes commas and formula-like text', () => {
  const state = E.createInitialState();
  state.feedback[0].comment = '=HYPERLINK("bad","click"), follow-up';
  const csv = E.exportFeedbackCsv(state);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /""bad""/);
});

test('recovery CSV includes accountable owner and status fields', () => {
  const csv = E.exportRecoveryCsv(E.createInitialState());
  assert.match(csv, /Owner,Status/);
  assert.match(csv, /Customer Care Supervisor/);
});
