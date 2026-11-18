import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../public/commitment-engine.js');
const Commitment = globalThis.CalloriaCommitmentEngine;
require('../public/promise-control-engine.js');
const Control = globalThis.CalloriaPromiseControlEngine;

function shift(date = '2026-11-18', minutes = 600) { return { date, minutes }; }
function makeStore() { return { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } }; }
function fixture(overrides = {}) {
  return {
    planId: '30-min', customerId: 'CUS-1001', customerName: 'Amara Bello', contactReference: 'CT-55001',
    caseId: 'CASE-55001', subject: 'Course access status', productId: 'ruffneck-lms', preferredChannel: 'Voice',
    owner: 'Agent One', team: 'Customer Care', commitment: 'Confirm course access after the enrolment check.', ...overrides
  };
}
function createAt(minutes, owner = 'Agent One') {
  const state = Commitment.createState();
  const item = Commitment.createCommitment(state, fixture({ owner }), shift('2026-11-18', minutes - 30), new Date('2026-11-18T09:00:00Z'));
  return { state, item };
}

test('portfolio classifies critical, due-now, at-risk, watch and normal commitments', () => {
  const state = Commitment.createState();
  const add = (planId, owner, contactReference) => Commitment.createCommitment(state, fixture({ planId, owner, contactReference }), shift('2026-11-18', 600), new Date('2026-11-18T09:00:00Z'));
  const overdue = add('30-min', 'Agent A', 'CT-1');
  overdue.dueDate = '2026-11-18'; overdue.dueMinutes = 540;
  const dueNow = add('30-min', 'Agent B', 'CT-2');
  dueNow.dueDate = '2026-11-18'; dueNow.dueMinutes = 600;
  const atRisk = add('30-min', 'Agent C', 'CT-3');
  atRisk.dueDate = '2026-11-18'; atRisk.dueMinutes = 625;
  const watch = add('30-min', 'Agent D', 'CT-4');
  watch.dueDate = '2026-11-18'; watch.dueMinutes = 650;
  const normal = add('30-min', 'Agent E', 'CT-5');
  normal.dueDate = '2026-11-18'; normal.dueMinutes = 700;
  const portfolio = Control.buildPortfolio(state, shift('2026-11-18', 600));
  const byId = new Map(portfolio.rows.map(row => [row.id, row.control.risk]));
  assert.equal(byId.get(overdue.id), 'critical');
  assert.equal(byId.get(dueNow.id), 'urgent');
  assert.equal(byId.get(atRisk.id), 'at_risk');
  assert.equal(byId.get(watch.id), 'watch');
  assert.equal(byId.get(normal.id), 'normal');
  assert.deepEqual(portfolio.rows.map(row => row.control.risk), ['critical', 'urgent', 'at_risk', 'watch', 'normal']);
});

test('portfolio detects commitments requiring review and due items without linked callback tasks', () => {
  const state = Commitment.createState();
  const item = Commitment.createCommitment(state, fixture(), shift('2026-11-18', 600));
  item.dueDate = '2026-11-18'; item.dueMinutes = 600;
  const portfolio = Control.buildPortfolio(state, shift('2026-11-18', 600), [], []);
  assert.equal(portfolio.metrics.missingCallbackTask, 1);
  assert.equal(portfolio.rows[0].control.missingCallbackTask, true);
  assert.equal(portfolio.rows[0].control.callbackStatus, 'missing');
  const linked = Control.buildPortfolio(state, shift('2026-11-18', 600), [{ id: 'CB-1', commitmentId: item.id, status: 'queued' }], []);
  assert.equal(linked.metrics.missingCallbackTask, 0);
  assert.equal(linked.rows[0].control.callbackStatus, 'queued');
});

test('owner exposure aggregates all open commitments and excludes completed promises', () => {
  const state = Commitment.createState();
  const a = Commitment.createCommitment(state, fixture({ owner: 'Agent One', contactReference: 'CT-A' }), shift());
  const b = Commitment.createCommitment(state, fixture({ owner: 'Agent One', contactReference: 'CT-B' }), shift());
  const c = Commitment.createCommitment(state, fixture({ owner: 'Agent Two', contactReference: 'CT-C' }), shift());
  Commitment.recordOutcome(state, c.id, { outcome: 'completed', summary: 'The customer confirmed the requested action and accepted the final update.' }, shift());
  const portfolio = Control.buildPortfolio(state, shift());
  assert.equal(portfolio.metrics.open, 2);
  assert.deepEqual(portfolio.owners.map(row => [row.owner, row.total]), [['Agent One', 2]]);
  assert.ok(portfolio.rows.some(row => row.id === a.id));
  assert.ok(portfolio.rows.some(row => row.id === b.id));
});

test('portfolio without an active shift does not misclassify a missing time delta as due now', () => {
  const state = Commitment.createState();
  const item = Commitment.createCommitment(state, fixture(), shift());
  const portfolio = Control.buildPortfolio(state, null);
  assert.equal(portfolio.rows[0].control.deltaMinutes, null);
  assert.equal(portfolio.rows[0].control.risk, 'normal');
  assert.equal(portfolio.metrics.dueNow, 0);
});

test('escalation requires a risk-window promise and a reason of at least 20 characters', () => {
  const state = Commitment.createState();
  const item = Commitment.createCommitment(state, fixture(), shift('2026-11-18', 600));
  item.dueDate = '2026-11-18'; item.dueMinutes = 620;
  const requests = [];
  assert.throws(() => Control.raiseEscalation({ commitmentId: item.id, reason: 'Too short' }, { commitmentState: state, shift: shift('2026-11-18', 600), supervisorRequests: requests }), /20 characters/i);
  assert.throws(() => Control.raiseEscalation({ commitmentId: item.id, reason: 'Needs escalation but the callback is not due yet.' }, { commitmentState: state, shift: shift('2026-11-18', 580), supervisorRequests: requests }), /not yet within/i);
  const request = Control.raiseEscalation({ commitmentId: item.id, reason: 'The confirmed callback window is close and ownership needs supervisor attention.' }, { commitmentState: state, shift: shift('2026-11-18', 600), supervisorRequests: requests, actor: 'Floor Supervisor', now: new Date('2026-11-18T10:00:00Z') });
  assert.equal(request.commitmentId, item.id);
  assert.equal(request.createdBy, 'Floor Supervisor');
  assert.equal(request.status, 'open');
  assert.equal(request.channel, 'Customer promise control');
  assert.equal(requests.length, 1);
});

test('duplicate open escalations and completed commitments are blocked', () => {
  const state = Commitment.createState();
  const item = Commitment.createCommitment(state, fixture(), shift());
  item.dueDate = '2026-11-18'; item.dueMinutes = 600;
  const requests = [];
  const context = { commitmentState: state, shift: shift('2026-11-18', 600), supervisorRequests: requests };
  Control.raiseEscalation({ commitmentId: item.id, reason: 'Customer is waiting beyond the promised due window and requires action.' }, context);
  assert.throws(() => Control.raiseEscalation({ commitmentId: item.id, reason: 'A second escalation is not permitted for the same open customer promise.' }, context), /already exists/i);
  item.status = 'Complete';
  assert.throws(() => Control.raiseEscalation({ commitmentId: item.id, reason: 'A completed customer promise must not be escalated again.' }, context), /completed/i);
});

test('supervisor recovery review requires a different reviewer and a documented action', () => {
  const state = Commitment.createState();
  const item = Commitment.createCommitment(state, fixture({ owner: 'Agent One' }), shift());
  item.dueDate = '2026-11-18'; item.dueMinutes = 600;
  const requests = [];
  const request = Control.raiseEscalation({ commitmentId: item.id, reason: 'The missed due time needs a reviewed service recovery and callback owner.' }, { commitmentState: state, shift: shift('2026-11-18', 600), supervisorRequests: requests });
  assert.throws(() => Control.resolveEscalation(requests, request.id, { reviewer: 'Agent One', actionTaken: 'This note is long enough but the owner cannot approve their own escalation.' }, { commitmentState: state }), /different from the original/i);
  assert.throws(() => Control.resolveEscalation(requests, request.id, { reviewer: 'Manager One', actionTaken: 'Too short' }, { commitmentState: state }), /20 characters/i);
  const resolved = Control.resolveEscalation(requests, request.id, { reviewer: 'Manager One', actionTaken: 'Supervisor confirmed the investigation owner and approved a factual customer update before the next callback attempt.' }, { commitmentState: state, now: new Date('2026-11-18T12:00:00Z') });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.resolvedBy, 'Manager One');
  assert.match(resolved.resolutionNotes, /factual customer update/);
  assert.equal(item.status, 'Open', 'reviewing an escalation must not close the underlying customer commitment');
  assert.throws(() => Control.resolveEscalation(requests, request.id, { reviewer: 'Manager Two', actionTaken: 'Trying to review an already resolved supervisor request.' }, { commitmentState: state }), /not found/i);
});

test('portfolio flags open escalation state without mutating commitment completion', () => {
  const state = Commitment.createState();
  const item = Commitment.createCommitment(state, fixture(), shift());
  item.dueDate = '2026-11-18'; item.dueMinutes = 600;
  const requests = [{ id: 'PROM-1', commitmentId: item.id, status: 'open', customer: item.customerName }];
  const portfolio = Control.buildPortfolio(state, shift('2026-11-18', 600), [], requests);
  assert.equal(portfolio.metrics.escalated, 1);
  assert.equal(portfolio.rows[0].control.escalationOpen, true);
  assert.equal(portfolio.rows[0].control.escalationId, 'PROM-1');
  assert.equal(item.status, 'Open');
});
