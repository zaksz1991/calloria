import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../public/customer-journey-engine.js');

const T0 = '2026-11-11T10:00:00.000Z';
function fresh() { return E.createInitialState(T0); }
function sampleInput(overrides = {}) {
  return { customerId: 'CUS-1001', subject: 'Password reset assistance', description: 'Customer cannot complete the account recovery process and needs a safe reset route.', productId: 'general', category: 'Account & access', priority: 'P3 - Normal', channel: 'Email', owner: 'Test Agent', team: 'Customer Care', ...overrides };
}
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key), dump: () => Object.fromEntries(values) };
}

test('initial state includes synthetic customers and service cases', () => {
  const state = fresh();
  assert.equal(state.customers.length, 7);
  assert.equal(state.cases.length, 6);
  assert.ok(state.cases.every((item) => E.getCustomer(state, item.customerId)));
});

test('empty state contains no customer or case records', () => {
  const state = E.createEmptyState(T0);
  assert.deepEqual(state.customers, []);
  assert.deepEqual(state.cases, []);
});

test('normaliseState repairs malformed arrays', () => {
  const state = E.normaliseState({ customers: null, cases: 'bad', activity: null }, T0);
  assert.deepEqual(state.customers, []);
  assert.deepEqual(state.cases, []);
  assert.deepEqual(state.activity, []);
});

test('load creates seed data when storage is empty', () => {
  const state = E.load(memoryStorage(), T0);
  assert.equal(state.customers.length, 7);
});

test('save and load preserve customer cases', () => {
  const storage = memoryStorage(); const state = fresh();
  assert.equal(E.save(state, storage), true);
  const loaded = E.load(storage, T0);
  assert.equal(loaded.cases.length, state.cases.length);
  assert.equal(loaded.customers[0].id, state.customers[0].id);
});

test('save returns false when browser storage throws', () => {
  assert.equal(E.save(fresh(), { setItem() { throw new Error('blocked'); } }), false);
});

test('customer creation stores permitted contact and service fields', () => {
  const state = fresh();
  const customer = E.createCustomer(state, { firstName: 'Tunde', lastName: 'Lawal', email: 'tunde.lawal@example.invalid', preferredChannel: 'Voice', services: ['kano-run'] }, T0);
  assert.equal(customer.firstName, 'Tunde');
  assert.deepEqual(customer.services, ['kano-run']);
});

test('customer creation requires first and last name', () => {
  assert.throws(() => E.createCustomer(fresh(), { firstName: 'T', lastName: 'Lawal' }, T0), /first name and last name/);
});

test('customer creation rejects malformed email', () => {
  assert.throws(() => E.createCustomer(fresh(), { firstName: 'Tunde', lastName: 'Lawal', email: 'not-an-email' }, T0), /valid email/);
});

test('customer creation prevents duplicate email', () => {
  const state = fresh();
  assert.throws(() => E.createCustomer(state, { firstName: 'Amara', lastName: 'Bello', email: 'AMARA.BELLO@example.invalid' }, T0), /Possible duplicate customer/);
});

test('customer creation prevents duplicate phone', () => {
  const state = fresh();
  assert.throws(() => E.createCustomer(state, { firstName: 'Amara', lastName: 'Other', phone: '+234 000 000 1001' }, T0), /Possible duplicate customer/);
});

test('customer update changes permitted profile fields and consent', () => {
  const state = fresh();
  const customer = E.updateCustomer(state, 'CUS-1001', { preferredChannel: 'Email', consent: { email: true, sms: true, marketing: false } }, T0);
  assert.equal(customer.preferredChannel, 'Email');
  assert.equal(customer.consent.sms, true);
  assert.equal(customer.consent.marketing, false);
});

test('customer update rejects unsupported preferred channel', () => {
  assert.throws(() => E.updateCustomer(fresh(), 'CUS-1001', { preferredChannel: 'Carrier pigeon' }, T0), /valid preferred channel/);
});

test('customer update rejects invalid status', () => {
  assert.throws(() => E.updateCustomer(fresh(), 'CUS-1001', { status: 'Deleted' }, T0), /valid customer status/);
});

test('customer note requires a meaningful note', () => {
  assert.throws(() => E.addCustomerNote(fresh(), 'CUS-1001', 'short', 'Agent', T0), /at least 10 characters/);
});

test('customer note is added to profile', () => {
  const state = fresh();
  const note = E.addCustomerNote(state, 'CUS-1001', 'Customer requested a call after 14:00 local time.', 'Test Agent', T0);
  assert.equal(state.customers[0].notes[0].id, note.id);
});

test('case creation assigns an SLA deadline from priority', () => {
  const state = fresh();
  const item = E.createCase(state, sampleInput({ priority: 'P2 - High' }), T0);
  assert.equal(new Date(item.dueAt).getTime() - new Date(T0).getTime(), 24 * 60 * 60000);
  assert.equal(item.status, 'New');
});

test('case creation requires an existing customer', () => {
  assert.throws(() => E.createCase(fresh(), sampleInput({ customerId: 'unknown' }), T0), /existing customer/);
});

test('case creation validates subject', () => {
  assert.throws(() => E.createCase(fresh(), sampleInput({ subject: 'no' }), T0), /subject must contain/);
});

test('case creation validates description', () => {
  assert.throws(() => E.createCase(fresh(), sampleInput({ description: 'too short' }), T0), /description must contain/);
});

test('case creation validates product', () => {
  assert.throws(() => E.createCase(fresh(), sampleInput({ productId: 'unknown' }), T0), /valid product/);
});

test('case creation validates category', () => {
  assert.throws(() => E.createCase(fresh(), sampleInput({ category: 'Unmapped' }), T0), /valid case category/);
});

test('case creation validates priority', () => {
  assert.throws(() => E.createCase(fresh(), sampleInput({ priority: 'P0' }), T0), /valid priority/);
});

test('case creation validates channel', () => {
  assert.throws(() => E.createCase(fresh(), sampleInput({ channel: 'Fax' }), T0), /valid contact channel/);
});

test('duplicate open case is blocked', () => {
  const state = fresh();
  const input = sampleInput({ customerId: 'CUS-1001', subject: 'Course enrolment has not completed', category: 'Technical support' });
  assert.throws(() => E.createCase(state, input, T0), /Possible duplicate case/);
});

test('case assignment requires a named owner', () => {
  const state = fresh();
  assert.throws(() => E.assignCase(state, 'CASE-54001', 'Unassigned', 'Care', T0), /named case owner/);
});

test('case assignment updates owner and team', () => {
  const state = fresh();
  const item = E.assignCase(state, 'CASE-54001', 'New Owner', 'Escalations', T0);
  assert.equal(item.owner, 'New Owner');
  assert.equal(item.team, 'Escalations');
});

test('invalid case status transition is rejected', () => {
  const state = fresh();
  assert.throws(() => E.updateStatus(state, 'CASE-54001', 'Closed', '', T0), /Status cannot move/);
});

test('resolution requires a resolution summary', () => {
  const state = fresh();
  assert.throws(() => E.updateStatus(state, 'CASE-54001', 'Resolved', 'done', T0), /resolution summary/);
});

test('case can be resolved then closed', () => {
  const state = fresh();
  E.updateStatus(state, 'CASE-54001', 'Resolved', 'Customer confirmed the course now appears in the enrolment list.', T0);
  const result = E.updateStatus(state, 'CASE-54001', 'Closed', '', T0);
  assert.equal(result.status, 'Closed');
  assert.ok(result.closedAt);
});

test('case with outstanding task cannot be closed', () => {
  const state = fresh();
  const item = state.cases.find((x) => x.id === 'CASE-54001');
  E.addTask(state, item.id, { title: 'Confirm resolution with customer', owner: 'Agent A', dueDate: '2026-11-12' }, T0);
  E.updateStatus(state, item.id, 'Resolved', 'The issue is fixed and the customer confirmed the expected enrolment result.', T0);
  assert.throws(() => E.updateStatus(state, item.id, 'Closed', '', T0), /outstanding tasks/);
});

test('pending customer status pauses SLA clock', () => {
  const state = fresh();
  const item = state.cases.find((x) => x.id === 'CASE-54001');
  E.updateStatus(state, item.id, 'Pending Customer', 'Waiting for requested confirmation.', T0);
  const check = '2026-11-11T11:00:00.000Z';
  assert.equal(E.slaStatus(item, check).state, 'paused');
});

test('SLA pause is added back when customer responds', () => {
  const state = fresh();
  const item = state.cases.find((x) => x.id === 'CASE-54001');
  E.updateStatus(state, item.id, 'Pending Customer', 'Waiting for requested confirmation.', T0);
  E.updateStatus(state, item.id, 'Open', '', '2026-11-11T12:00:00.000Z');
  assert.equal(item.pausedMs, 2 * 3600000);
  assert.equal(item.pausedAt, null);
});

test('SLA calculation identifies overdue work', () => {
  const state = fresh();
  const item = E.createCase(state, sampleInput({ priority: 'P4 - Low' }), T0);
  assert.equal(E.slaStatus(item, '2026-11-20T10:00:00.000Z').state, 'breached');
});

test('SLA calculation identifies due-soon work', () => {
  const state = fresh();
  const item = E.createCase(state, sampleInput({ priority: 'P1 - Urgent' }), T0);
  assert.equal(E.slaStatus(item, '2026-11-11T11:00:00.000Z').state, 'due-soon');
});

test('interaction summary has minimum length', () => {
  const state = fresh();
  assert.throws(() => E.addInteraction(state, 'CASE-54001', { channel: 'Voice', summary: 'short' }, T0), /at least 15 characters/);
});

test('interaction record validates channel', () => {
  const state = fresh();
  assert.throws(() => E.addInteraction(state, 'CASE-54001', { channel: 'Fax', summary: 'Customer was advised of the next steps.' }, T0), /valid channel/);
});

test('interaction is appended to case and customer journey', () => {
  const state = fresh();
  const interaction = E.addInteraction(state, 'CASE-54001', { channel: 'Voice', direction: 'Outbound', visibility: 'Customer-facing', summary: 'Customer was called and confirmed the enrolment now works.' }, T0);
  assert.equal(state.cases.find((x) => x.id === 'CASE-54001').interactions[0].id, interaction.id);
  assert.ok(E.getCustomerTimeline(state, 'CUS-1001').some((event) => event.type === 'interaction'));
});

test('closed case cannot receive interactions', () => {
  const state = fresh();
  E.updateStatus(state, 'CASE-54005', 'Closed', '', T0);
  assert.throws(() => E.addInteraction(state, 'CASE-54005', { channel: 'Voice', summary: 'Customer was called and outcome explained clearly.' }, T0), /Closed cases/);
});

test('task requires title, owner and date', () => {
  assert.throws(() => E.addTask(fresh(), 'CASE-54001', { title: 'Task', owner: '', dueDate: 'bad' }, T0), /task and a named owner/);
});

test('task can be completed', () => {
  const state = fresh(); const item = state.cases.find((x) => x.id === 'CASE-54001');
  const task = E.addTask(state, item.id, { title: 'Check the completed enrolment', owner: 'Agent A', dueDate: '2026-11-12' }, T0);
  assert.equal(E.completeTask(state, item.id, task.id, T0).status, 'Complete');
});

test('customer search matches identifiers and names', () => {
  const state = fresh();
  assert.equal(E.searchCustomers(state, 'Amara').length, 1);
  assert.equal(E.searchCustomers(state, 'CUS-1002')[0].lastName, 'Garba');
});

test('case search filters status and free text', () => {
  const state = fresh();
  assert.equal(E.searchCases(state, { status: 'Pending Customer' }).length, 1);
  assert.ok(E.searchCases(state, { query: 'Garba' }).some((item) => item.customerId === 'CUS-1002'));
});

test('customer timeline includes notes and case events', () => {
  const state = fresh();
  E.addCustomerNote(state, 'CUS-1001', 'Customer asked for an update after the afternoon briefing.', 'Trainer', T0);
  const timeline = E.getCustomerTimeline(state, 'CUS-1001');
  assert.ok(timeline.some((event) => event.type === 'note'));
  assert.ok(timeline.some((event) => event.type === 'case'));
});

test('metrics count active, new and resolved cases', () => {
  const m = E.getMetrics(fresh(), T0);
  assert.equal(m.totalCases, 6);
  assert.ok(m.activeCases > 0);
  assert.equal(m.newCases, 1);
  assert.equal(m.resolved, 1);
});

test('linked incident reader exposes open records only', () => {
  const storage = memoryStorage({ [E.RELIABILITY_KEY]: JSON.stringify({ incidents: [
    { id: 'i1', reference: 'INC-1', title: 'Open fault', productId: 'kano-run', status: 'Investigating', severity: 'SEV 2 - High', summary: 'A sufficiently detailed incident summary for a test.' },
    { id: 'i2', reference: 'INC-2', title: 'Closed fault', productId: 'kano-run', status: 'Closed', severity: 'SEV 4 - Low' }
  ] }) });
  assert.deepEqual(E.readLinkedIncidents(storage).map((item) => item.id), ['i1']);
});

test('incident case uses severity to set priority and keeps incident reference', () => {
  const state = fresh(); const incident = { id: 'i1', reference: 'INC-2026-000001', title: 'Player login disruption', productId: 'kano-run', severity: 'SEV 1 - Critical', summary: 'A simulated player login disruption is preventing affected users from entering the game.' };
  const item = E.createCaseFromIncident(state, incident, 'CUS-1002', 'Recovery Agent', T0);
  assert.equal(item.priority, 'P1 - Urgent');
  assert.equal(item.sourceIncidentReference, incident.reference);
});

test('incident case requires a customer anchor', () => {
  const state = fresh();
  assert.throws(() => E.createCaseFromIncident(state, { id: 'i1', reference: 'INC-1', title: 'Incident', productId: 'kano-run', severity: 'SEV 2 - High' }, 'missing', 'Owner', T0), /customer profile/);
});

test('knowledge search only returns published and unexpired articles', () => {
  const storage = memoryStorage({ [E.KNOWLEDGE_KEY]: JSON.stringify({ articles: [
    { id: 'a1', title: 'Account access help', summary: 'Access support guidance', keywords: 'login', status: 'Published', expiresAt: '2026-12-01', version: 2 },
    { id: 'a2', title: 'Draft article', status: 'Draft' },
    { id: 'a3', title: 'Expired article', status: 'Published', expiresAt: '2026-10-01' }
  ] }) });
  assert.deepEqual(E.searchPublishedKnowledge('login', storage, T0).map((item) => item.id), ['a1']);
});

test('knowledge article can be referenced in a case timeline', () => {
  const state = fresh(); const article = { id: 'kb-a1', title: 'Account access guide', version: 3 };
  const item = E.addArticleReference(state, 'CASE-54001', article, T0);
  assert.ok(item.tags.includes('kb:kb-a1'));
  assert.ok(item.timeline.some((event) => event.type === 'knowledge-reference'));
});

test('case register CSV escapes commas and quotes', () => {
  const state = fresh();
  E.createCase(state, sampleInput({ subject: 'A "quoted", subject' }), T0);
  const csv = E.exportCasesCsv(state);
  assert.ok(csv.includes('"A ""quoted"", subject"'));
  assert.ok(csv.startsWith('"Reference","Customer ID"'));
});

test('applying the current status is an idempotent no-op', () => {
  const state = fresh(); const item = state.cases.find((x) => x.id === 'CASE-54001');
  const before = item.timeline.length;
  assert.equal(E.updateStatus(state, item.id, item.status, '', T0), item);
  assert.equal(item.timeline.length, before);
});

test('new cases must be triaged before they can be resolved or closed', () => {
  const state = fresh();
  assert.throws(() => E.updateStatus(state, 'CASE-54006', 'Closed', '', T0), /Status cannot move/);
});

test('reopening a resolved case requires a reason and archives the prior resolution', () => {
  const state = fresh(); const item = state.cases.find((x) => x.id === 'CASE-54005');
  assert.throws(() => E.updateStatus(state, item.id, 'Open', 'short', T0), /explaining why the case is being reopened/);
  E.updateStatus(state, item.id, 'Open', 'Customer reported that the same issue has returned and needs another investigation.', T0);
  assert.equal(item.status, 'Open');
  assert.equal(item.resolution, null);
  assert.equal(item.previousResolutions.length, 1);
});

test('CSV export neutralises formula-like customer-controlled values', () => {
  const state = fresh();
  E.createCase(state, sampleInput({ subject: '=HYPERLINK("https://example.invalid","open")' }), T0);
  const csv = E.exportCasesCsv(state);
  assert.ok(csv.includes("'=HYPERLINK(\"\"https://example.invalid\"\",\"\"open\"\")"));
});
